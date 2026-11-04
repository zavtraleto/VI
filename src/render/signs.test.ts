import { describe, expect, it } from 'vitest';
import { CHAIN_PULSE_MS } from './marks';
import { zoneTurn } from './signs';

describe('zoneTurn', () => {
  it('stays on the one chain a cell is beside', () => {
    for (const t of [0, 500, 1300, 99999]) expect(zoneTurn(1, t)).toEqual({ from: 0, to: 0, share: 0 });
  });

  it('holds one chain a beat, goes over to the next the next beat', () => {
    const beat = CHAIN_PULSE_MS;
    expect(zoneTurn(2, 0)).toEqual({ from: 0, to: 1, share: 0 });
    expect(zoneTurn(2, beat * 0.9).share).toBe(0);
    expect(zoneTurn(2, beat * 1.5).share).toBeCloseTo(0.5, 6);
    expect(zoneTurn(2, beat * 1.999).share).toBeGreaterThan(0.99);
    expect(zoneTurn(2, beat * 2)).toEqual({ from: 1, to: 0, share: 0 });
    expect(zoneTurn(2, beat * 4)).toEqual({ from: 0, to: 1, share: 0 });
  });

  it('goes round three chains in turn', () => {
    const turn = CHAIN_PULSE_MS * 2;
    expect([0, 1, 2, 3].map((i) => zoneTurn(3, turn * i + 1).from)).toEqual([0, 1, 2, 0]);
    expect(zoneTurn(3, turn * 2 + 1).to).toBe(0);
  });
});
