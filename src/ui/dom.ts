type Child = Node | string | null | undefined | false;

/** Small element builder. Text children are always inserted as text nodes. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { class?: string; id?: string; text?: string; attrs?: Record<string, string>; onClick?: () => void } = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.class) el.className = props.class;
  if (props.id) el.id = props.id;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
  if (props.onClick) el.addEventListener('click', props.onClick);
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

export function formatTime(ticks: number, tickMs: number): string {
  const seconds = Math.floor((ticks * tickMs) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
