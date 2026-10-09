// Checks the documents of the project: `node scripts/docs-check.mjs`.
// Every page under docs/ opens with a header of its kind and status, is named in the index,
// and links only to files that exist; a page of the kind «истина» names only code that exists.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KINDS = ['истина', 'решение', 'исследование', 'план'];
const STATUSES = ['в силе', 'построено', 'вытеснено', 'отменено', 'черновик', 'выполнен', 'не выполнен'];
const INDEX = 'docs/README.md';

const walk = (dir) =>
  readdirSync(join(root, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(join(root, path)).isDirectory() ? walk(path) : path.endsWith('.md') ? [path] : [];
  });

const pages = [...walk('docs'), 'README.md', 'CLAUDE.md'];
const index = existsSync(join(root, INDEX)) ? readFileSync(join(root, INDEX), 'utf8') : '';
const problems = [];
const say = (page, text) => problems.push(`${page}: ${text}`);

for (const page of pages) {
  const text = readFileSync(join(root, page), 'utf8');
  const inDocs = page.startsWith('docs/') && page !== INDEX;
  let kind = null;

  if (inDocs) {
    const header = text.split('\n').slice(0, 8).find((line) => line.startsWith('> Вид:'));
    const found = header && /^> Вид: ([^.]+)\. Статус: ([^.(:]+)/.exec(header);
    if (!found) say(page, 'нет шапки «> Вид: … Статус: …»');
    else {
      kind = found[1].trim();
      const status = found[2].trim();
      if (!KINDS.includes(kind)) say(page, `вид «${kind}» не из словаря`);
      if (!STATUSES.includes(status)) say(page, `статус «${status}» не из словаря`);
    }
    if (!index.includes(page.slice('docs/'.length))) say(page, `нет в индексе ${INDEX}`);
  }

  for (const [, target] of text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue;
    const path = normalize(join(dirname(page), decodeURI(target)));
    if (!existsSync(join(root, path))) say(page, `ссылка в никуда: ${target}`);
  }

  if (kind === 'истина' || !inDocs) {
    const named = new Set(text.match(/\b(?:src|scripts|public)\/[\w./-]+\.(?:ts|mjs|js|json|png|jpg|svg|css|html)\b/g));
    for (const path of named) if (!existsSync(join(root, path))) say(page, `нет в коде: ${path}`);
  }
}

if (problems.length === 0) console.log(`docs-check: ${pages.length} страниц, расхождений нет`);
else {
  for (const line of problems) console.log(line);
  console.log(`docs-check: расхождений ${problems.length}`);
  process.exitCode = 1;
}
