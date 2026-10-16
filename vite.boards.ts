import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { askOf, boardHash, exportFile, headPatchOf, historyFile, patchHead, renamedText, renameOf, rowOpOf, safeName, swapOf, versionOf } from './src/lab/boardsServer';
import { readBoardHead } from './src/levels/boardFile';
import { fastGrammar } from './src/levels/grammar';
import { buildRow, readRowFile, rowText, touchesRow } from './src/levels/row';
import { rowEdit, rowFileText, swapBoardTexts, withStatus } from './src/levels/rowEdit';

/**
 * The files of the lab of the levels for the page `?lab=levels`: the dev server reads and writes
 * the boards of `boards/`, keeps every version of a board in `boards/.history/` (which git does
 * not see), writes down the plays, and tells the page when a board is changed on the disk by
 * anyone else, an agent or an editor. What is asked and what is refused is `askOf` of
 * src/lab/boardsServer.ts. Of the dev server only: a build has nothing of it.
 */
export function viBoards(): Plugin {
  return {
    name: 'vi-boards',
    apply: 'serve',
    configureServer(server) {
      const dir = resolve(server.config.root, 'boards');
      const history = (name: string): string => join(dir, '.history', name);
      const versions = (name: string) =>
        existsSync(history(name))
          ? readdirSync(history(name)).sort().flatMap((file) => versionOf(file) ?? [])
          : [];
      // A version is kept where the text is a board, and is another board than the version before it.
      const keep = (name: string, text: string): string | null => {
        const hash = boardHash(text, name);
        if (hash === null) return null;
        if (versions(name).at(-1)?.hash !== hash) {
          mkdirSync(history(name), { recursive: true });
          writeFileSync(join(history(name), historyFile(hash, new Date())), text);
        }
        return hash;
      };
      const rowPath = join(dir, 'row.json');
      // Every board of boards/ by its name, as `relay` reads them.
      const boardTexts = (): Map<string, string> =>
        new Map(readdirSync(dir).filter((one) => one.endsWith('.txt')).map((one) => [basename(one, '.txt'), readFileSync(join(dir, one), 'utf8')]));

      server.middlewares.use('/__boards', (request, response) => {
        const send = (status: number, body: string, type = 'application/json'): void => {
          response.statusCode = status;
          response.setHeader('Content-Type', `${type}; charset=utf-8`);
          response.setHeader('Cache-Control', 'no-store');
          response.end(body);
        };
        const body = (): Promise<string> =>
          new Promise((done, fail) => {
            const chunks: Buffer[] = [];
            request.on('data', (chunk: Buffer) => chunks.push(chunk));
            request.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
            request.on('error', fail);
          });
        const ask = askOf(request.method ?? 'GET', request.url ?? '');
        void (async () => {
          if (ask.kind === 'refused') return send(ask.status, JSON.stringify({ error: ask.why }));
          if (ask.kind === 'list') {
            // A file whose name is no name of a board is left out: the page could not ask for it.
            const names = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.txt')).map((file) => basename(file, '.txt')).filter((name) => safeName(name) !== null).sort() : [];
            return send(200, JSON.stringify(names));
          }
          if (ask.kind === 'heads') {
            // Every board with its text, the hash of its version and the time its file was last written.
            const names = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.txt')).map((file) => basename(file, '.txt')).filter((name) => safeName(name) !== null).sort() : [];
            return send(200, JSON.stringify(names.map((name) => {
              const text = readFileSync(join(dir, `${name}.txt`), 'utf8');
              return { name, text, hash: boardHash(text, name), time: statSync(join(dir, `${name}.txt`)).mtime.toISOString() };
            })));
          }
          if (ask.kind === 'row-read') return existsSync(rowPath) ? send(200, readFileSync(rowPath, 'utf8'), 'application/json') : send(404, JSON.stringify({ error: 'no boards/row.json' }));
          if (ask.kind === 'row') {
            // An operation on the row, whole or not at all: the new row.json and the statuses it gives are laid together, and
            // written only where the row is laid; a refusal says its line and nothing is written. `relay` lays row.gen.ts after.
            const op = rowOpOf(await body());
            if (!op) return send(400, JSON.stringify({ error: 'an operation on the row is insert, move, remove or edit, with the words of row.ts' }));
            let written: { row: string; files: [string, string][]; violations: unknown };
            try {
              const { file, statuses } = rowEdit(readRowFile(readFileSync(rowPath, 'utf8')), op);
              const texts = boardTexts();
              const files = Object.entries(statuses).map(([code, status]): [string, string] => {
                const text = texts.get(code);
                if (text === undefined) throw new Error(`row: there is no file boards/${code}.txt`);
                texts.set(code, withStatus(text, status));
                return [code, texts.get(code)!];
              });
              written = { row: rowFileText(file), files, violations: fastGrammar(buildRow(file, texts).places) };
            } catch (error) {
              return send(409, JSON.stringify({ error: (error as Error).message }));
            }
            for (const [code, text] of written.files) writeFileSync(join(dir, `${code}.txt`), text);
            writeFileSync(rowPath, written.row);
            return send(200, JSON.stringify({ violations: written.violations }));
          }
          if (ask.kind === 'export') {
            // The text a session of the library gave out, kept beside the history: said once, however often it is given.
            const text = await body();
            const kept = join(dir, '.history', exportFile(ask.date));
            mkdirSync(join(dir, '.history'), { recursive: true });
            const there = existsSync(kept) ? readFileSync(kept, 'utf8') : '';
            if (!there.includes(text)) writeFileSync(kept, there === '' ? text : `${there}\n${text}`);
            return send(200, JSON.stringify({ file: `boards/.history/${exportFile(ask.date)}` }));
          }
          const file = join(dir, `${ask.name}.txt`);
          if (ask.kind === 'head') {
            // A status, a mark and words laid into the head: the board is the same, so no version is kept.
            const patch = headPatchOf(await body());
            if (!patch) return send(400, JSON.stringify({ error: 'a head is { status?: N | D | RC | X, mark?, words?: [{ date, text }] }' }));
            if (!existsSync(file)) return send(404, JSON.stringify({ error: `no board ${ask.name}` }));
            try {
              writeFileSync(file, patchHead(readFileSync(file, 'utf8'), patch));
            } catch (error) {
              return send(400, JSON.stringify({ error: (error as Error).message }));
            }
            return send(200, '{}');
          }
          if (ask.kind === 'rename') {
            // A board is given a new name: the file, and its history and plays with it, or none of them. A name that is taken, by a
            // board or by a history, and a board of the row, by row.json or by its own R, are refused before anything is written.
            const to = renameOf(await body());
            if (!to) return send(400, JSON.stringify({ error: 'a rename is { to: <name of a board> }' }));
            if (!existsSync(file)) return send(404, JSON.stringify({ error: `no board ${ask.name}` }));
            const target = join(dir, `${to}.txt`);
            if (existsSync(target)) return send(409, JSON.stringify({ error: `there is a board ${to} already` }));
            if (existsSync(history(to))) return send(409, JSON.stringify({ error: `there is a history of ${to} already: the history of ${ask.name} would be left behind` }));
            const text = readFileSync(file, 'utf8');
            if (readBoardHead(text).status === 'R') return send(409, JSON.stringify({ error: `${ask.name} is a board of the row by its status R: its code is what the players' progress keeps` }));
            const row = readRowFile(readFileSync(join(dir, 'row.json'), 'utf8'));
            if (row.chapters.some((chapter) => chapter.places.some((place) => place.board === ask.name))) return send(409, JSON.stringify({ error: `${ask.name} is a board of the row: its code is what the players' progress keeps` }));
            writeFileSync(target, renamedText(text, to));
            unlinkSync(file);
            if (existsSync(history(ask.name))) renameSync(history(ask.name), history(to));
            return send(200, JSON.stringify({ name: to }));
          }
          if (ask.kind === 'swap') {
            // The board of a copy goes into the file of the row and the board of that file into the copy, both or neither
            // (section 11.2): the code, the place and the progress of the players stay. A copy of the row itself, the file
            // swapped with itself in any letter case, a file that cannot be read and a row that is not laid are refused first.
            const asked = swapOf(await body());
            if (!asked) return send(400, JSON.stringify({ error: 'a swap is { from: <name of a board> }' }));
            if (asked.toLowerCase() === ask.name.toLowerCase()) return send(409, JSON.stringify({ error: `${asked} is the file of ${ask.name} itself` }));
            // Both by the names their files have: the row is laid on the texts by those names, whatever case the page said them in.
            const texts = boardTexts();
            const named = (name: string): string | undefined => [...texts.keys()].find((one) => one.toLowerCase() === name.toLowerCase());
            const code = named(ask.name);
            const from = named(asked);
            if (code === undefined) return send(404, JSON.stringify({ error: `no board ${ask.name}` }));
            if (from === undefined) return send(404, JSON.stringify({ error: `no board ${asked}` }));
            let swapped: { kept: string; other: string };
            try {
              const row = readRowFile(readFileSync(rowPath, 'utf8'));
              if (row.chapters.some((chapter) => chapter.places.some((place) => place.board.toLowerCase() === from.toLowerCase()))) throw new Error(`${from} is a board of the row: its board is not given away`);
              const day = new Date().toISOString().slice(0, 10);
              swapped = swapBoardTexts(texts.get(code)!, texts.get(from)!, `прежняя доска ${code}, заменена ${day}`);
              texts.set(code, swapped.kept);
              texts.set(from, swapped.other);
              buildRow(row, texts);
            } catch (error) {
              return send(409, JSON.stringify({ error: (error as Error).message }));
            }
            writeFileSync(join(dir, `${code}.txt`), swapped.kept);
            writeFileSync(join(dir, `${from}.txt`), swapped.other);
            keep(code, swapped.kept);
            keep(from, swapped.other);
            return send(200, '{}');
          }
          if (ask.kind === 'read') return existsSync(file) ? send(200, readFileSync(file, 'utf8'), 'text/plain') : send(404, JSON.stringify({ error: `no board ${ask.name}` }));
          if (ask.kind === 'write') {
            const text = await body();
            mkdirSync(dir, { recursive: true });
            writeFileSync(file, text);
            const hash = keep(ask.name, text);
            if (hash === null) return send(200, JSON.stringify({ error: 'the text is no board: written, and no version kept' }));
            return send(200, JSON.stringify({ hash }));
          }
          if (ask.kind === 'history') return send(200, JSON.stringify(versions(ask.name)));
          if (ask.kind === 'version') {
            const kept = join(history(ask.name), ask.file);
            return existsSync(kept) ? send(200, readFileSync(kept, 'utf8'), 'text/plain') : send(404, JSON.stringify({ error: `no version ${ask.file}` }));
          }
          const plays = join(history(ask.name), 'plays.jsonl');
          if (ask.kind === 'plays') {
            const lines = existsSync(plays) ? readFileSync(plays, 'utf8').split('\n').filter((line) => line.trim() !== '') : [];
            return send(200, `[${lines.join(',')}]`);
          }
          // A play is written down as it is given, if it is JSON: one line to a play.
          const play = await body();
          try {
            mkdirSync(history(ask.name), { recursive: true });
            appendFileSync(plays, `${JSON.stringify(JSON.parse(play))}\n`);
          } catch {
            return send(400, JSON.stringify({ error: 'a play is a line of JSON' }));
          }
          return send(200, '{}');
        })().catch((error: Error) => send(500, JSON.stringify({ error: error.message })));
      });

      // A board changed on the disk is told to the page by its name: the files of the history and of boards/out are no boards.
      server.watcher.add(dir);
      const told = (path: string): void => {
        const full = resolve(path);
        if (!full.startsWith(dir + sep) || full.slice(dir.length + 1).includes(sep) || !full.endsWith('.txt')) return;
        server.ws.send({ type: 'custom', event: 'vi:boards', data: { name: basename(full, '.txt') } });
      };
      server.watcher.on('add', told);
      server.watcher.on('change', told);
      server.watcher.on('unlink', told);

      // The row the game reads is laid again when row.json or a board of it is written, by the lab or by anyone
      // (docs/superpowers/specs/2026-10-15-vi-row-json-design.md, section 4.4). A row that cannot be laid is said on
      // the server and over the page, and row.gen.ts is left as it was.
      const genFile = resolve(server.config.root, 'src/levels/row.gen.ts');
      const relay = (path: string): void => {
        const full = resolve(path);
        if (dirname(full) !== dir) return;
        try {
          const file = readRowFile(readFileSync(rowPath, 'utf8'));
          if (!touchesRow(basename(full), file)) return;
          const text = rowText(buildRow(file, boardTexts()));
          if (!existsSync(genFile) || readFileSync(genFile, 'utf8') !== text) writeFileSync(genFile, text);
        } catch (error) {
          const message = (error as Error).message;
          server.config.logger.error(message);
          server.ws.send({ type: 'error', err: { message, stack: '' } });
        }
      };
      server.watcher.on('add', relay);
      server.watcher.on('change', relay);
      server.watcher.on('unlink', relay);
    },
  };
}
