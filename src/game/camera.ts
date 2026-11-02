import Phaser from 'phaser';
import { TILE } from './constants';
import { uiScaleFor } from './viewport';

export { PIXEL_BUDGET, renderScaleFor, uiScaleFor } from './viewport';

/** Default zoom keeps tiles at least this many CSS px (docs/design/ACCESSIBILITY.md §5). */
export const MIN_DEFAULT_TILE = 48;
export const FLOOR_TILE = 40;

export interface FitResult {
  collapsePalette: boolean;
  collapseTutorial: boolean;
}

export class CameraController {
  minZoom = 0.4;
  maxZoom = 2.2;
  /** Canvas pixels per CSS pixel (see renderScaleFor). All paddings below are CSS px. */
  k = 1;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private worldW = 0;
  private worldH = 0;
  /** Screen-space padding reserved for the HUD (top bar / bottom palette). */
  padTop = 60;
  padBottom = 118;
  padBottomCollapsed = 72;
  /** Last framing request, re-run on resize. */
  lastMode: 'yard' | 'used' = 'used';
  lastUsed: { x: number; y: number; w: number; h: number } | null = null;

  constructor(private scene: Phaser.Scene) {
    this.cam = scene.cameras.main;
  }

  setWorldSize(tilesW: number, tilesH: number): void {
    this.worldW = tilesW * TILE;
    this.worldH = tilesH * TILE;
  }

  /**
   * Fit the open garden into the viewport. If that would make tiles smaller than 48 px,
   * ask the HUD to collapse the palette and fit again; never go under the 40 px floor.
   * Returns whether the palette should collapse.
   */
  fit(paletteOpen: boolean, tutorialOpen = false): FitResult {
    this.lastMode = 'yard';
    return this.fitRect(0, 0, this.worldW, this.worldH, paletteOpen, tutorialOpen, false);
  }

  /** The camera's zoom in CSS px per world px (what the player sees). */
  get cssZoom(): number {
    return this.cam.zoom / this.k;
  }

  /** The viewport in CSS px. */
  get cssSize(): { w: number; h: number } {
    return { w: this.scene.scale.width / this.k, h: this.scene.scale.height / this.k };
  }

  /**
   * Default framing: the part of the yard that is in use (structures plus a margin),
   * so a first chain fills the screen instead of floating in empty lawn. Zoom is capped
   * so tiles never exceed 96 px; the player can still Fit the whole yard.
   */
  frameUsed(used: { x: number; y: number; w: number; h: number }, paletteOpen: boolean, tutorialOpen = false): FitResult {
    this.lastMode = 'used';
    this.lastUsed = used;
    return this.fitRect(used.x * TILE, used.y * TILE, used.w * TILE, used.h * TILE, paletteOpen, tutorialOpen, true);
  }

  /** Width of the tip/order cards at this window width (mirrors src/ui/styles.css). */
  private cardWidth(vw: number): number {
    if (vw <= 1050) return 212;
    if (vw <= 1150) return 232;
    return 264;
  }

  reframe(paletteOpen: boolean, tutorialOpen = false): FitResult {
    if (this.lastMode === 'used' && this.lastUsed) return this.frameUsed(this.lastUsed, paletteOpen, tutorialOpen);
    return this.fit(paletteOpen, tutorialOpen);
  }

  /** On-screen box of a HUD element in CSS px, or null when it is not showing. */
  private hudRect(selector: string): DOMRect | null {
    if (typeof document === 'undefined') return null;
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 ? r : null;
  }

  private fitRect(rx: number, ry: number, rw: number, rh: number, paletteOpen: boolean, tutorialOpen: boolean, capZoom: boolean): FitResult {
    // Everything here is in CSS px; the canvas may have k pixels per CSS px.
    const { w: vw, h: vh } = this.cssSize;
    const ui = uiScaleFor(vw);
    const w = rw + TILE * 0.2;
    const h = rh + TILE * 0.2;
    const gap = 8;
    // Frame inside the free column: between the tip and order cards, below the top bar and
    // above the palette. Measure the real HUD when it is on screen (it scales with the
    // window); fall back to the CSS breakpoint widths before the HUD exists.
    const card = this.cardWidth(vw) * ui + 16;
    const bar = this.hudRect('.topbar');
    const padTop = bar ? bar.bottom + gap : this.padTop * ui;
    const pal = this.hudRect('.palette');
    const padBottomOpen = pal && paletteOpen ? vh - pal.top + gap : (paletteOpen ? this.padBottom : this.padBottomCollapsed) * ui;
    const padBottomClosed = this.padBottomCollapsed * ui;
    const tip = this.hudRect('.tutorial');
    const leftOpen = tip ? tip.right + gap : card;
    const order = this.hudRect('.orderpanel');
    const right = order ? vw - order.left + gap : card;
    const zoomFor = (padBottom: number, leftGutter: number) => Math.min((vw - leftGutter - right) / w, (vh - padTop - padBottom) / h);
    let collapse = false;
    let collapseTutorial = false;
    let padBottom = padBottomOpen;
    let left = tutorialOpen ? leftOpen : 16;
    let zoom = zoomFor(padBottom, left);
    if (paletteOpen && zoom * TILE < MIN_DEFAULT_TILE) {
      collapse = true;
      padBottom = padBottomClosed;
      zoom = zoomFor(padBottom, left);
    }
    // On a narrow window the whole yard cannot sit beside both side cards at the 40 px
    // floor; rather than let the tip card cover the yard's edge, close the tip card.
    if (tutorialOpen && zoom * TILE < FLOOR_TILE) {
      collapseTutorial = true;
      left = 16;
      zoom = zoomFor(padBottom, left);
    }
    zoom = Phaser.Math.Clamp(zoom, FLOOR_TILE / TILE, (capZoom ? 1.5 : this.maxZoom) * ui);
    this.cam.setZoom(zoom * this.k);
    // Put the framed area's centre at the centre of the free column: the camera's own centre
    // sits that much further toward the bigger inset (right card / palette) in world units.
    const offsetX = (right - left) / 2 / zoom;
    const offsetY = (padBottom - padTop) / 2 / zoom;
    this.cam.centerOn(rx + rw / 2 + offsetX, ry + rh / 2 + offsetY);
    this.clamp();
    return { collapsePalette: collapse, collapseTutorial };
  }

  centerOnGarden(padBottom = this.padBottom): void {
    const offsetY = ((padBottom - this.padTop) * this.k) / 2 / this.cam.zoom;
    this.cam.centerOn(this.worldW / 2, this.worldH / 2 + offsetY);
    this.clamp();
  }

  zoomAt(screenX: number, screenY: number, factor: number): void {
    const before = this.cam.getWorldPoint(screenX, screenY);
    const ui = uiScaleFor(this.cssSize.w);
    const zoom = Phaser.Math.Clamp(this.cam.zoom * factor, this.minZoom * this.k, this.maxZoom * ui * this.k);
    this.cam.setZoom(zoom);
    const after = this.cam.getWorldPoint(screenX, screenY);
    this.cam.scrollX += before.x - after.x;
    this.cam.scrollY += before.y - after.y;
    this.clamp();
  }

  panBy(dxScreen: number, dyScreen: number): void {
    this.cam.scrollX -= dxScreen / this.cam.zoom;
    this.cam.scrollY -= dyScreen / this.cam.zoom;
    this.clamp();
  }

  /** Scroll just enough that the tile is inside the view (used by the keyboard cursor). */
  ensureTileVisible(tx: number, ty: number): void {
    const z = this.cam.zoom;
    const view = this.cam.worldView;
    const x0 = tx * TILE;
    const y0 = ty * TILE;
    const ui = uiScaleFor(this.cssSize.w) * this.k;
    const marginX = (this.padTop * ui) / z;
    const top = view.y + (this.padTop * ui) / z;
    const bottom = view.bottom - (this.padBottom * ui) / z;
    if (x0 < view.x + marginX) this.cam.scrollX -= view.x + marginX - x0;
    else if (x0 + TILE > view.right - marginX) this.cam.scrollX += x0 + TILE - (view.right - marginX);
    if (y0 < top) this.cam.scrollY -= top - y0;
    else if (y0 + TILE > bottom) this.cam.scrollY += y0 + TILE - bottom;
    this.clamp();
  }

  /** Keep the garden from drifting completely off screen. */
  clamp(): void {
    const vw = this.cam.width / this.cam.zoom;
    const vh = this.cam.height / this.cam.zoom;
    const margin = TILE * 2;
    const minX = -vw + margin;
    const maxX = this.worldW - margin;
    const minY = -vh + margin;
    const maxY = this.worldH - margin;
    this.cam.scrollX = Phaser.Math.Clamp(this.cam.scrollX, Math.min(minX, maxX), Math.max(minX, maxX));
    this.cam.scrollY = Phaser.Math.Clamp(this.cam.scrollY, Math.min(minY, maxY), Math.max(minY, maxY));
  }
}
