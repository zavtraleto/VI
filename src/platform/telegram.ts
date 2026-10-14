/**
 * Telegram opens a link in a browser of its own, and that browser folds or closes itself on a
 * swipe down, on a swipe from the edge and on the back of the system. A player drags over the
 * board all the time, so the game holds that browser still while it is the one being touched.
 *
 * Both apps put `TelegramWebviewProxy` into every frame of the page, the frame of a portal's
 * page included, and nothing else does: without it nothing here runs. How each app decides
 * on its gestures is read from its sources (Telegram-Android `webview_ext.js` and
 * `ChatAttachAlertBotWebViewLayout.WebViewSwipeContainer`, Telegram-iOS `BrowserWebContent.swift`).
 * The meta tags `tg:swipes:x` and `tg:swipes:y` in `index.html` do the same on Android when
 * the game is the page itself.
 */

type TelegramProxy = { postEvent(type: string, data: string): void };

export function holdTelegramBrowser(): void {
  const proxy = (window as { TelegramWebviewProxy?: TelegramProxy }).TelegramWebviewProxy;
  if (!proxy || typeof proxy.postEvent !== 'function') return;

  // A touch on the game is the game's. Android swipes the browser only when the page says the
  // touch is free (`allowScroll`); its own script cannot see a touch inside a portal's frame,
  // so the game says it. iOS lets go of its swipe on `cancellingTouch`.
  const claim = (): void => {
    try {
      proxy.postEvent('allowScroll', '[false,false]');
      proxy.postEvent('cancellingTouch', '{}');
    } catch {
      // A bridge that refuses changes nothing of the game.
    }
  };
  document.addEventListener('touchstart', claim, { capture: true, passive: true });
  document.addEventListener('touchmove', claim, { capture: true, passive: true });

  // The back of the system and the swipe from the edge of iOS close the browser only when the
  // page has nowhere to go back to. One step of history is laid under the game, and laid again
  // after it is spent. It is laid on a touch let go: a step laid without the player's hand
  // is skipped by the back of Chrome.
  let laid = false;
  const lay = (): void => {
    if (laid) return;
    try {
      history.pushState(history.state, '');
      laid = true;
    } catch {
      // A frame that may not write its history keeps the browser's back as it is.
    }
  };
  window.addEventListener('pointerup', lay, true);
  window.addEventListener('popstate', () => {
    laid = false;
  });
}
