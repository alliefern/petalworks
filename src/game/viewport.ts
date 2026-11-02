/** Pure viewport rules shared by the camera, the HUD CSS and the tools. No Phaser here. */

/**
 * HUD scale for a window width in CSS px. Mirrors the `.hud { zoom }` media queries in
 * src/ui/styles.css: cards and buttons grow on very wide screens so they are not tiny on 4K.
 */
export function uiScaleFor(vw: number): number {
  if (vw >= 3000) return 1.6;
  if (vw >= 2200) return 1.3;
  return 1;
}

/**
 * Canvas pixels per CSS pixel. Follows the device pixel ratio (capped at 2) so the garden
 * is sharp on high-DPI screens, within a pixel budget so a 4K screen at 2x does not
 * ask the GPU for a 33-megapixel canvas.
 */
export const PIXEL_BUDGET = 16_000_000;
export function renderScaleFor(cssW: number, cssH: number, dpr: number): number {
  const budget = Math.sqrt(PIXEL_BUDGET / Math.max(1, cssW * cssH));
  return Math.max(1, Math.min(dpr || 1, 2, budget));
}

/**
 * Smallest tile Fit (the whole yard) may show, in CSS px. The hard floor is 40 px
 * (docs/design/ACCESSIBILITY.md §5); only on windows shorter than 700 px may Fit go to
 * 34 px so a small laptop still sees the whole yard. Default framing always keeps 40.
 */
export const FIT_FLOOR_SHORT_WINDOW = 34;
export const SHORT_WINDOW_HEIGHT = 700;
export function fitFloorFor(vh: number, hardFloor = 40): number {
  return vh < SHORT_WINDOW_HEIGHT ? Math.min(hardFloor, FIT_FLOOR_SHORT_WINDOW) : hardFloor;
}
