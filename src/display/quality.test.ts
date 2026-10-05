import { describe, expect, it } from 'vitest';
import { DEFAULT_QUALITY, readQuality } from './quality';

describe('readQuality', () => {
  it('is the defaults when the address names nothing', () => {
    expect(readQuality('')).toEqual(DEFAULT_QUALITY);
    expect(readQuality('?lab=board&hour=12')).toEqual(DEFAULT_QUALITY);
  });

  it('takes each setting from the address', () => {
    expect(readQuality('?msaa=2&ratio=1.25&video=off&halo=off&leak=off&cap=60&patch=off')).toEqual({
      samples: 2,
      auto: false,
      maxRatio: 1.25,
      video: false,
      halo: false,
      leak: false,
      fpsCap: 60,
      patches: false,
    });
    expect(readQuality('?msaa=0').samples).toBe(0);
    expect(readQuality('?auto=off')).toEqual({ ...DEFAULT_QUALITY, auto: false });
  });

  it('keeps the default where the address makes no sense', () => {
    expect(readQuality('?msaa=3&ratio=9&cap=-5&video=on&leak=&patch=yes')).toEqual(DEFAULT_QUALITY);
    expect(readQuality('?msaa=&ratio=abc')).toEqual(DEFAULT_QUALITY);
  });
});
