import { describe, expect, it } from 'vitest';
import { BAR, windowLayout } from './window';

const WIDE = { width: 640, height: 360 };
const TALL = { width: 280, height: 606 };

describe('windowLayout', () => {
  it('keeps the window on the screen and its parts inside it', () => {
    for (const picture of [WIDE, TALL]) {
      for (const contact of [0, 0.3, 0.7, 1]) {
        const { frame, title, content, status } = windowLayout(picture, contact);
        expect(frame.x).toBeGreaterThanOrEqual(0);
        expect(frame.y).toBeGreaterThanOrEqual(0);
        expect(frame.x + frame.w).toBeLessThanOrEqual(picture.width);
        expect(frame.y + frame.h).toBeLessThanOrEqual(picture.height);
        for (const part of [title, content, status]) {
          expect(part.x).toBeGreaterThan(frame.x);
          expect(part.x + part.w).toBeLessThan(frame.x + frame.w);
        }
        // Title, picture and readings lie one under the other with nothing between them.
        expect(title.h).toBe(BAR);
        expect(content.y).toBe(title.y + title.h);
        expect(status.y).toBe(content.y + content.h);
        expect(status.y + status.h).toBe(frame.y + frame.h - 1);
        expect(content.h).toBeGreaterThan(40);
      }
    }
  });

  it('stands in the middle of the screen', () => {
    const { frame } = windowLayout(WIDE, 0.4);
    expect(Math.abs(frame.x * 2 + frame.w - WIDE.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(frame.y * 2 + frame.h - WIDE.height)).toBeLessThanOrEqual(1);
  });

  it('stands anywhere on the screen it is put, and never off it', () => {
    for (const picture of [WIDE, TALL]) {
      const corners = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: -4, y: 9 },
      ];
      for (const place of corners) {
        const { frame } = windowLayout(picture, 0.2, place);
        expect(frame.x).toBeGreaterThanOrEqual(0);
        expect(frame.y).toBeGreaterThanOrEqual(0);
        expect(frame.x + frame.w).toBeLessThanOrEqual(picture.width);
        expect(frame.y + frame.h).toBeLessThanOrEqual(picture.height);
      }
      const size = windowLayout(picture, 0.2).frame;
      const first = windowLayout(picture, 0.2, { x: 0, y: 0 }).frame;
      const last = windowLayout(picture, 0.2, { x: 1, y: 1 }).frame;
      // The place moves the window and leaves its size alone.
      expect([first.w, first.h, last.w, last.h]).toEqual([size.w, size.h, size.w, size.h]);
      expect(last.x + last.y).toBeGreaterThan(first.x + first.y);
    }
  });

  it('has nowhere to move once it fills the screen', () => {
    expect(windowLayout(WIDE, 1, { x: 0, y: 0 }).frame).toEqual(windowLayout(WIDE, 1, { x: 1, y: 1 }).frame);
  });

  it('grows with the contact until it fills the screen', () => {
    for (const picture of [WIDE, TALL]) {
      const sizes = [0, 0.25, 0.5, 0.75, 1].map((contact) => windowLayout(picture, contact).frame);
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i].w).toBeGreaterThanOrEqual(sizes[i - 1].w);
        expect(sizes[i].h).toBeGreaterThan(sizes[i - 1].h);
      }
      const full = sizes[sizes.length - 1];
      expect(full.w).toBeGreaterThan(picture.width - 12);
      expect(full.h).toBeGreaterThan(picture.height - 12);
    }
  });

  it('shows the smallest picture four wide to three high, on a tall screen too', () => {
    for (const picture of [WIDE, TALL]) {
      const { content } = windowLayout(picture, 0);
      expect(content.w / content.h).toBeCloseTo(4 / 3, 1);
    }
    expect(windowLayout(TALL, 0).frame.w).toBeGreaterThan(TALL.width * 0.8);
  });
});
