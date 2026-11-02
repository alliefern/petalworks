import { describe, expect, it } from 'vitest';
import { fitFloorFor, PIXEL_BUDGET, renderScaleFor, uiScaleFor } from './viewport';

describe('viewport rules', () => {
  it('lets Fit drop to 34 px tiles only on windows shorter than 700 px', () => {
    expect(fitFloorFor(640)).toBe(34);
    expect(fitFloorFor(699)).toBe(34);
    expect(fitFloorFor(700)).toBe(40);
    expect(fitFloorFor(1080)).toBe(40);
  });
  it('scales the HUD up only on very wide windows, matching the CSS breakpoints', () => {
    expect(uiScaleFor(1024)).toBe(1);
    expect(uiScaleFor(1920)).toBe(1);
    expect(uiScaleFor(2199)).toBe(1);
    expect(uiScaleFor(2560)).toBe(1.3);
    expect(uiScaleFor(3840)).toBe(1.6);
  });
  it('renders sharp at 2x within the pixel budget, never below 1x', () => {
    expect(renderScaleFor(1920, 1080, 1)).toBe(1);
    expect(renderScaleFor(1920, 1080, 2)).toBe(2);
    expect(renderScaleFor(1920, 1080, 3)).toBe(2);
    expect(renderScaleFor(2560, 1440, 2)).toBe(2);
    const k4 = renderScaleFor(3840, 2160, 2);
    expect(k4).toBeGreaterThan(1);
    expect(k4).toBeLessThan(2);
    expect(3840 * k4 * 2160 * k4).toBeLessThanOrEqual(PIXEL_BUDGET + 1);
    expect(renderScaleFor(1024, 640, 0.8)).toBe(1);
  });
});
