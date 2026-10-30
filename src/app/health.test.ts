import { describe, expect, it } from 'vitest';
import { nameOf, sourceOf } from './health';

const ORIGIN = 'https://game.example';

describe('what is told of an error', () => {
  it('says whose file it came from, never the address', () => {
    expect(sourceOf(`${ORIGIN}/assets/index-abc.js`, ORIGIN)).toBe('game');
    expect(sourceOf(`${ORIGIN}/assets/vendor-abc.js`, ORIGIN)).toBe('vendor');
    expect(sourceOf(`${ORIGIN}/src/app/game.ts`, ORIGIN)).toBe('game');
    expect(sourceOf(`${ORIGIN}/node_modules/.vite/deps/three.js`, ORIGIN)).toBe('vendor');
    expect(sourceOf('https://sdk.crazygames.com/crazygames-sdk-v3.js', ORIGIN)).toBe('external');
    expect(sourceOf(`${ORIGIN}/playgama-bridge.js`, ORIGIN)).toBe('other');
    expect(sourceOf(null, ORIGIN)).toBe('other');
    expect(sourceOf('not an address', ORIGIN)).toBe('other');
  });

  it('names the error by its kind out of a few, never by what it says', () => {
    expect(nameOf(new TypeError('x is undefined'))).toBe('TypeError');
    expect(nameOf({ name: 'QuotaExceededError' })).toBe('QuotaExceededError');
    expect(nameOf({ name: 'MyOwnError' })).toBe('other');
    expect(nameOf('a string thrown')).toBe('other');
    expect(nameOf(null)).toBe('other');
  });
});
