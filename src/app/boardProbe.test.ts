import { describe, expect, it } from 'vitest';
import { boardNameOf, isBoardName } from './boardProbe';

describe('boardNameOf', () => {
  it('reads the name of a board from the address', () => {
    expect(boardNameOf('?board=H01')).toBe('H01');
    expect(boardNameOf('?lab=levels&board=P06-2')).toBe('P06-2');
    expect(boardNameOf('')).toBeNull();
    expect(boardNameOf('?levels')).toBeNull();
  });
  it('takes no name that could be a path', () => {
    expect(boardNameOf('?board=../x')).toBeNull();
    expect(boardNameOf('?board=a/b')).toBeNull();
    expect(boardNameOf('?board=a%5Cb')).toBeNull();
    expect(boardNameOf('?board=H01.txt')).toBeNull();
    expect(boardNameOf('?board=')).toBeNull();
    expect(isBoardName('a'.repeat(65))).toBe(false);
  });
});
