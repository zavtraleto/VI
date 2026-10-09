import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import playgamaBridge from '@playgama/bridge/vite';
import JavaScriptObfuscator from 'javascript-obfuscator';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

/** The chunk of the libraries: three.js is open code and the heaviest part of a frame, so it is left as it is. */
const VENDOR = 'vendor';

/**
 * Makes the game's own code hard to read: names are replaced, strings are taken out into an
 * encoded table, the flow of a part of the functions is flattened. It costs 230 kB of the
 * file and a fifth of a millisecond of a frame, so a build is plain unless it is asked for
 * with `VI_OBFUSCATE=1`. The build is written first and the files are rewritten after it, so
 * the bundler's own passes are over by then. The seed is fixed: the same source gives the
 * same file.
 */
function obfuscate(): Plugin {
  let outDir = 'dist';
  return {
    name: 'vi-obfuscate',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk' || chunk.name === VENDOR) continue;
        const file = join(outDir, chunk.fileName);
        const result = JavaScriptObfuscator.obfuscate(readFileSync(file, 'utf8'), {
          seed: 6,
          target: 'browser',
          compact: true,
          simplify: true,
          sourceMap: false,
          identifierNamesGenerator: 'mangled-shuffled',
          renameGlobals: false,
          stringArray: true,
          stringArrayThreshold: 1,
          stringArrayEncoding: ['base64'],
          stringArrayRotate: true,
          stringArrayShuffle: true,
          stringArrayIndexShift: true,
          stringArrayWrappersCount: 1,
          stringArrayWrappersType: 'variable',
          transformObjectKeys: true,
          // A quarter of the functions: more of it costs frames on a phone. Split strings,
          // numbers as expressions and wrappers as functions are left out: together they
          // make the file three times as heavy and add little to how hard it is to read.
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.25,
          // These three break a build that a platform repacks, or get in the way of its checks.
          deadCodeInjection: false,
          selfDefending: false,
          debugProtection: false,
          disableConsoleOutput: false,
          unicodeEscapeSequence: false,
        });
        writeFileSync(file, result.getObfuscatedCode());
      }
    },
  };
}

/**
 * The fonts come as woff2 with a woff copy for browsers that are no longer around. The copy
 * is dropped from the style, so its files do not go into the build.
 */
function woff2Only(): Plugin {
  return {
    name: 'vi-woff2-only',
    enforce: 'pre',
    transform(code, id) {
      if (!/@fontsource[\\/].*\.css/.test(id)) return null;
      return { code: code.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, ''), map: null };
    },
  };
}

export default defineConfig({
  base: './',
  define: { 'import.meta.env.VI_VERSION': JSON.stringify(version) },
  // The Bridge SDK of the platform: from its CDN, with the copy of the package as a fallback.
  plugins: [playgamaBridge({ mode: 'cdn' }), woff2Only(), ...(process.env.VI_OBFUSCATE ? [obfuscate()] : [])],
  // The preview tooling passes its own port when 5183 is already taken by another session.
  server: { host: true, port: Number(process.env.PORT) || 5183, strictPort: true },
  build: {
    sourcemap: false,
    modulePreload: { polyfill: false },
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [{ name: VENDOR, test: /node_modules/ }] },
      },
    },
  },
  // The files are run side by side, and a test that plays whole runs takes three times as long among them as alone:
  // the five seconds a test gets unless said were what `bot.test.ts` took to the millisecond, and one file more tipped it.
  test: { include: ['src/**/*.test.ts'], testTimeout: 20_000 },
});
