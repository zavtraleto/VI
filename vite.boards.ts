import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { askOf, boardHash, exportFile, headPatchOf, historyFile, patchHead, renamedText, renameOf, safeName, versionOf } from './src/lab/boardsServer';
import { readBoardHead } from './src/levels/boardFile';
import { buildRow, readRowFile, rowText, touchesRow } from './src/levels/row';

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
            // Every board with its text and the hash of its version, for the table of the library.
            const names = existsSync(dir) ? readdirSync(dir).filter((file) => file.endsWith('.txt')).map((file) => basename(file, '.txt')).filter((name) => safeName(name) !== null).sort() : [];
            return send(200, JSON.stringify(names.map((name) => {
              const text = readFileSync(join(dir, `${name}.txt`), 'utf8');
              return { name, text, hash: boardHash(text, name) };
            })));
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
          if (ask.kind === 'read') return existsSync(file) ? send(200, readFileSync(file, 'utf8'), 'text/plain') : send(404, JSON.stringify({ error: `no board ${ask.name}` }));
          if (ask.kind === 'write') {
            const text = await body();
            mkdirSync(dir, { recursive: true });
            writeFileSync(file, text);
            // A version is kept where the text is a board, and is another board than the version before it.
            const hash = boardHash(text, ask.name);
            if (hash === null) return send(200, JSON.stringify({ error: 'the text is no board: written, and no version kept' }));
            const last = versions(ask.name).at(-1);
            if (last?.hash !== hash) {
              mkdirSync(history(ask.name), { recursive: true });
              writeFileSync(join(history(ask.name), historyFile(hash, new Date())), text);
            }
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
          const file = readRowFile(readFileSync(join(dir, 'row.json'), 'utf8'));
          if (!touchesRow(basename(full), file)) return;
          const texts = new Map(readdirSync(dir).filter((one) => one.endsWith('.txt')).map((one) => [basename(one, '.txt'), readFileSync(join(dir, one), 'utf8')]));
          const text = rowText(buildRow(file, texts));
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
