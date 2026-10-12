/**
 * The name of a board of the lab asked for in the address, `?board=H01`: a file of `boards/`
 * without its `.txt`. A name is letters, digits, `-` and `_`, sixty-four of them at the most:
 * anything else, a dot or a slash above all, is no name, since the name becomes a path. Null
 * where the address asks for no board, or for one by a name that is none.
 */
export function boardNameOf(search: string): string | null {
  const name = new URLSearchParams(search).get('board');
  return name !== null && isBoardName(name) ? name : null;
}

export function isBoardName(name: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(name);
}
