import { describe, expect, it } from 'vitest';
import { placeLabelInView } from './labelPlace';

describe('placeLabelInView', () => {
  const screen = { w: 1024, h: 640 };
  // Measured 1024×640 HUD: the order card ends above the closed-field label.
  const cards = [
    { left: 800, top: 66, right: 1012, bottom: 244 },
    { left: 12, top: 66, right: 224, bottom: 255 },
    { left: 12, top: 10, right: 1012, bottom: 66 },
    { left: 454, top: 568, right: 570, bottom: 628 },
  ];

  it('pulls a clipped label back on screen without crossing the garden', () => {
    const placed = placeLabelInView({ x: 963, y: 318 }, { w: 201, h: 56 }, screen, cards);
    expect(placed).toEqual({ x: 915.5, y: 318 });
  });

  it('drops the label below a card that covers its anchor', () => {
    const covered = [{ left: 700, top: 100, right: 1000, bottom: 400 }];
    expect(placeLabelInView({ x: 850, y: 300 }, { w: 180, h: 50 }, screen, covered)).toEqual({ x: 850, y: 433 });
  });

  it('leaves a label that already fits where it is', () => {
    expect(placeLabelInView({ x: 400, y: 300 }, { w: 100, h: 40 }, screen, cards)).toEqual({ x: 400, y: 300 });
  });

  it('hides the label when its anchor is off screen', () => {
    expect(placeLabelInView({ x: 1100, y: 318 }, { w: 201, h: 56 }, screen, cards)).toBeNull();
    expect(placeLabelInView({ x: -4, y: 318 }, { w: 201, h: 56 }, screen, cards)).toBeNull();
  });

  it('hides the label when it is wider than the window', () => {
    expect(placeLabelInView({ x: 200, y: 100 }, { w: 900, h: 40 }, { w: 400, h: 300 }, [])).toBeNull();
  });

  it('keeps a wide-window label on screen and clear of the order card', () => {
    const wide = { w: 1366, h: 768 };
    const order = [{ left: 1090, top: 66, right: 1354, bottom: 302 }];
    const placed = placeLabelInView({ x: 1211, y: 382 }, { w: 201, h: 56 }, wide, order);
    expect(placed).toEqual({ x: 1211, y: 382 });
  });
});