// PostToolUse hook for Edit and Write: after a document of the project is changed (a .md file
// under docs/, or README.md, or CLAUDE.md), runs `node scripts/docs-check.mjs` in the checkout
// that holds the file — the main folder or a worktree, whichever it is. If the check finds
// problems, ends with code 2 and gives its output on stderr (Claude Code shows it to the agent;
// the edit is already made). Otherwise ends with code 0 and says nothing.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

// The root of the checkout that holds the file: the nearest folder above it with scripts/docs-check.mjs.
function rootOf(file) {
  let dir = dirname(file);
  for (;;) {
    if (existsSync(join(dir, 'scripts', 'docs-check.mjs'))) return dir;
    const up = dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(input || '{}');
  } catch {
    process.exit(0);
  }
  const given = String(data?.tool_input?.file_path ?? '');
  if (!given.toLowerCase().endsWith('.md')) process.exit(0);
  const file = resolve(data?.cwd ?? process.cwd(), given);
  const root = rootOf(file);
  if (!root) process.exit(0);
  const path = relative(root, file).split(sep).join('/');
  const checked = path.startsWith('docs/') || path === 'README.md' || path === 'CLAUDE.md';
  if (!checked) process.exit(0);

  const run = spawnSync(process.execPath, ['scripts/docs-check.mjs'], { cwd: root, encoding: 'utf8' });
  if (run.status === 0 && !run.error) process.exit(0);
  const said = [run.stdout, run.stderr, run.error?.message].filter(Boolean).join('\n').trim();
  process.stderr.write(`docs-check после правки ${path} (${root}):\n${said}\nИсправь ссылки, шапки или индекс в том же наборе изменений.\n`);
  process.exit(2);
});
