import type { Plugin } from 'vite';

/** The SDK v3 of CrazyGames (docs.crazygames.com/sdk/intro): from their address only, there is no copy to carry. */
const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

/** CrazyGames in a build: the SDK in the head of the page, before the game, as their docs ask. */
export function crazygames(): Plugin[] {
  return [
    {
      name: 'vi-crazygames-sdk',
      apply: 'build',
      transformIndexHtml: () => [{ tag: 'script', attrs: { src: SDK_URL }, injectTo: 'head-prepend' }],
    },
  ];
}
