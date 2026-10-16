import type { RowOp } from '../levels/rowEdit';
import type { HeadPatch, Version } from './boardsServer';

/**
 * The files of the lab of the levels as the page asks for them: every call is an address of the
 * plugin of the dev server (`vite.boards.ts`; what each address does is told in
 * `src/lab/boardsServer.ts`). A name is put into an address as it is: the server takes none
 * that could be a path.
 */
const at = (name: string, rest = ''): string => `/__boards/${encodeURIComponent(name)}${rest}`;

async function asked(address: string, init?: RequestInit): Promise<Response> {
  const answer = await fetch(address, { cache: 'no-store', ...init });
  if (!answer.ok) throw new Error(`${init?.method ?? 'GET'} ${address}: ${answer.status} ${(await answer.text()).slice(0, 200)}`);
  return answer;
}

/** The names of the boards there are, sorted. */
export async function listBoards(): Promise<string[]> {
  return (await (await asked('/__boards')).json()) as string[];
}

export async function readBoard(name: string): Promise<string> {
  return (await asked(at(name))).text();
}

/** Writes the file of a board. The hash of the version kept, where the text is a board; what was wrong, where it is not. */
export async function writeBoard(name: string, text: string): Promise<{ hash?: string; error?: string }> {
  // `keepalive`: a write begun as the page is closed is still made.
  return (await (await asked(at(name), { method: 'PUT', body: text, keepalive: true })).json()) as { hash?: string; error?: string };
}

/** The versions of a board that are kept, the oldest first. */
export async function historyOf(name: string): Promise<Version[]> {
  return (await (await asked(at(name, '/history'))).json()) as Version[];
}

export async function readVersion(name: string, file: string): Promise<string> {
  return (await asked(at(name, `/history/${encodeURIComponent(file)}`))).text();
}

/** The plays written down for a board, of every version of it. */
export async function playsOf<T>(name: string): Promise<T[]> {
  return (await (await asked(at(name, '/plays'))).json()) as T[];
}

export async function addPlay(name: string, play: unknown): Promise<void> {
  await asked(at(name, '/plays'), { method: 'POST', body: JSON.stringify(play) });
}

/** Every board with its text, the hash of its version and the time its file was last written. */
export async function listHeads(): Promise<{ name: string; text: string; hash: string | null; time?: string }[]> {
  return (await (await asked('/__boards?heads')).json()) as { name: string; text: string; hash: string | null; time?: string }[];
}

/** Lays a status, a mark and words into the head of a board's file; no version is kept, the board being the same. */
export async function writeHead(name: string, patch: HeadPatch): Promise<void> {
  await asked(at(name, '/head'), { method: 'PUT', body: JSON.stringify(patch) });
}

/** Gives a board a new name: its file, history and plays go over to it. Refused where the name is taken or the board is of the row. */
export async function renameBoard(name: string, to: string): Promise<void> {
  await asked(at(name, '/rename'), { method: 'POST', body: JSON.stringify({ to }) });
}

/** The text of boards/row.json. */
export async function readRow(): Promise<string> {
  return (await asked('/__boards?row')).text();
}

/**
 * Does an operation on the row: the server writes the new row.json and the statuses it gives, or
 * nothing, and refuses with the line the row was refused in. The grammar of the row is the page's
 * to read (`fastGrammar`), on the row it reads again.
 */
export async function editRow(op: RowOp): Promise<void> {
  await asked('/__boards?row', { method: 'POST', body: JSON.stringify(op) });
}

/** Gives the board of the file `from` to the board `code`, and the board of `code` to `from`, as a candidate; both or neither. */
export async function swapBoards(code: string, from: string): Promise<void> {
  await asked(at(code, '/swap'), { method: 'POST', body: JSON.stringify({ from }) });
}

/** Keeps the text a session of the library gave out, in `boards/.history/export-<date>.md`; the path it is kept at. */
export async function writeExport(date: string, text: string): Promise<string> {
  return ((await (await asked(`/__boards?export=${encodeURIComponent(date)}`, { method: 'POST', body: text })).json()) as { file: string }).file;
}

/** Calls `told` with the name of a board whenever its file is changed on the disk, by this page or by anyone else. */
export function onBoardChanged(told: (name: string) => void): void {
  import.meta.hot?.on('vi:boards', (data: { name: string }) => told(data.name));
}
