import type { Version } from './boardsServer';

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

/** Calls `told` with the name of a board whenever its file is changed on the disk, by this page or by anyone else. */
export function onBoardChanged(told: (name: string) => void): void {
  import.meta.hot?.on('vi:boards', (data: { name: string }) => told(data.name));
}
