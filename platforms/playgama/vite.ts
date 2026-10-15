import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import playgamaBridge from '@playgama/bridge/vite';
import type { Plugin } from 'vite';

/** The settings of the SDK: advertisement, tables, the public token. It lies beside the page in the build. */
const CONFIG = 'playgama-bridge-config.json';

/**
 * Playgama in a build: the Bridge SDK in the page, from its CDN with the copy of the package as
 * a fallback, and its settings beside the page.
 */
export function playgama(): Plugin[] {
  let root = '.';
  return [
    playgamaBridge({ mode: 'cdn' }),
    {
      name: 'vi-playgama-config',
      apply: 'build',
      configResolved(config) {
        root = config.root;
      },
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: CONFIG, source: readFileSync(join(root, 'platforms', 'playgama', CONFIG)) });
      },
    },
  ];
}
