/** Puts text on the clipboard; says whether it got there. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // No permission, or the page is not focused: the old way below still works.
  }
  // The clipboard API is missing on a page opened over plain http, as from a phone on the same network.
  const area = document.createElement('textarea');
  area.value = text;
  area.style.cssText = 'position:fixed;left:0;top:0;opacity:0';
  document.body.append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  return copied;
}
