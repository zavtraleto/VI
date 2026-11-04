// PreToolUse hook for Bash and PowerShell: refuses the git commands that destroy work or take
// other people's files into a commit. Reads the hook's JSON from stdin, looks at
// tool_input.command; a refused command ends with code 2 and the reason on stderr (Claude Code
// shows it to the agent), anything else ends with code 0 and says nothing.
//
//   echo '{"tool_input":{"command":"git status"}}' | node .claude/hooks/guard-git.mjs   -> 0

const RULE =
  'Правило CLAUDE.md: чужое в папке не чинить силой (reset --hard, stash, checkout --), в коммит брать только свои файлы, без git add -A. ' +
  'Если мешают чужие незакоммиченные правки — остановиться и сказать пользователю.';

// The command split into segments at ; && || | and new lines, outside quotes; each segment into words.
function segments(command) {
  const out = [];
  let words = [];
  let word = '';
  let quote = null;
  let started = false;
  const endWord = () => {
    if (started) words.push(word);
    word = '';
    started = false;
  };
  const endSegment = () => {
    endWord();
    if (words.length) out.push(words);
    words = [];
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote) {
      if (c === quote) quote = null;
      else word += c;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      started = true;
    } else if (c === ';' || c === '|' || c === '\n' || c === '\r' || (c === '&' && command[i + 1] === '&')) {
      endSegment();
      if (c === '&' || (c === '|' && command[i + 1] === '|')) i++;
    } else if (c === '&') {
      endSegment();
    } else if (/\s/.test(c)) {
      endWord();
    } else {
      word += c;
      started = true;
    }
  }
  endSegment();
  return out;
}

// From the words of one segment: the git subcommand and its arguments, or null if the segment is not git.
function gitCall(words) {
  const at = words.findIndex((w) => /(^|[\\/])git(\.exe)?$/i.test(w));
  if (at < 0) return null;
  let i = at + 1;
  while (i < words.length && words[i].startsWith('-')) {
    // Options of git itself that take a value: -C <path>, -c <name=value>.
    if (words[i] === '-C' || words[i] === '-c') i += 2;
    else i += 1;
  }
  if (i >= words.length) return null;
  return { sub: words[i], args: words.slice(i + 1) };
}

const has = (args, ...flags) => args.some((a) => flags.includes(a));
// A short flag inside a cluster: -fd has f, -xfd has f.
const short = (args, letter) => args.some((a) => /^-[a-zA-Z]+$/.test(a) && a.includes(letter));

function refusal({ sub, args }) {
  switch (sub) {
    case 'reset':
      if (has(args, '--hard')) return '`git reset --hard` стирает незакоммиченные правки. Свои правки — в коммит или во временный WIP-коммит; чужие — не трогать.';
      return null;
    case 'push':
      if (has(args, '--force', '-f', '--force-with-lease') || args.some((a) => a.startsWith('--force')) || short(args, 'f'))
        return '`git push --force` переписывает историю origin. Публикация — только `git push origin HEAD:main` после rebase на origin/main и «ок» пользователя.';
      if (args.some((a) => a.startsWith('+'))) return 'Refspec с `+` — это push с силой. Публикация — только обычным push после rebase.';
      return null;
    case 'checkout':
      if (has(args, '--') || has(args, '.')) return '`git checkout -- <файл>` / `git checkout .` выбрасывает правки в рабочем дереве. Чужое не чинить силой — сказать пользователю.';
      return null;
    case 'restore': {
      const staged = has(args, '--staged', '-S');
      const worktree = has(args, '--worktree', '-W') || args.some((a) => /^-[a-zA-Z]*W/.test(a));
      if (!staged || worktree) return '`git restore` без `--staged` выбрасывает правки в рабочем дереве. Снять из индекса можно `git restore --staged <файл>`.';
      return null;
    }
    case 'stash': {
      const what = args[0];
      if (what === 'list' || what === 'show') return null;
      return '`git stash` общий для всех worktree и сессий: можно забрать или потерять чужое. Свою работу откладывать временным WIP-коммитом.';
    }
    case 'clean':
      if (has(args, '--force') || short(args, 'f')) return '`git clean -f` безвозвратно удаляет неотслеживаемые файлы, в том числе чужие. Посмотреть — `git clean -n`; удалять — только своё и руками.';
      return null;
    case 'add':
      if (has(args, '-A', '--all', '.', '-u', '--update') || args.some((a) => a === './' || a === ':/' || a === '*'))
        return '`git add -A` / `git add .` берёт в коммит всё, в том числе чужие правки. Добавлять только свои файлы поимённо: `git add <путь> <путь>`.';
      return null;
    case 'branch':
      if (has(args, '-D') || (has(args, '--delete', '-d') && has(args, '--force', '-f')))
        return '`git branch -D` удаляет ветку с невлитыми коммитами. Уборку веток решает пользователь; влитую ветку удаляет `git branch -d`.';
      return null;
    case 'worktree':
      if (args[0] === 'remove' && (has(args, '--force', '-f') || short(args.slice(1), 'f')))
        return '`git worktree remove --force` уничтожает незакоммиченное в worktree. Уборку worktree решает пользователь.';
      return null;
    default:
      return null;
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  let command = '';
  try {
    command = String(JSON.parse(input || '{}')?.tool_input?.command ?? '');
  } catch {
    process.exit(0);
  }
  if (!/\bgit\b/i.test(command)) process.exit(0);
  for (const words of segments(command)) {
    const call = gitCall(words);
    if (!call) continue;
    const why = refusal(call);
    if (why) {
      process.stderr.write(`Запрещено hook-ом .claude/hooks/guard-git.mjs: ${why}\n${RULE}\n`);
      process.exit(2);
    }
  }
  process.exit(0);
});
