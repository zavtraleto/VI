import { PROGRAM_FONT, paletteAt, shellDefaults } from '../shell/theme';

/** The labs of the dev build, by their address, with a line of what each is for. */
const LABS: readonly { lab: string; what: string }[] = [
  { lab: 'workshop', what: 'мастерская уровней: доски, игра, отметка, правка' },
  { lab: 'board', what: 'вид поля и костей; уход группы — папка «Уход»' },
  { lab: 'juice', what: 'ответы игры: каждый удар по кнопке' },
  { lab: 'lock', what: 'управление кликом: рамка цели и её числа' },
  { lab: 'sound', what: 'звук: кнопка на каждый звук и его параметры' },
  { lab: 'shell', what: 'экраны оболочки программы' },
  { lab: 'frame', what: 'передачи: сцены сигнала' },
];

/** The page of `?lab` with nothing after it: every lab there is, a line to each. */
export function startLabIndex(): void {
  const palette = paletteAt(shellDefaults(), 0);
  const page = document.createElement('div');
  page.style.cssText = `position:fixed;inset:0;z-index:900;padding:24px;background:${palette.bg};color:${palette.ink};font:15px/1.8 ${PROGRAM_FONT}`;
  for (const { lab, what } of LABS) {
    const line = document.createElement('div');
    const link = document.createElement('a');
    link.href = `?lab=${lab}`;
    link.textContent = `?lab=${lab}`;
    link.style.cssText = `color:${palette.ink};margin-right:16px`;
    const said = document.createElement('span');
    said.textContent = what;
    said.style.color = palette.dim;
    line.append(link, said);
    page.append(line);
  }
  document.body.append(page);
}
