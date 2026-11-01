import Phaser from 'phaser';
import { TILE } from './constants';

/** Default zoom keeps tiles at least this many CSS px (docs/design/ACCESSIBILITY.md §5). */
export const MIN_DEFAULT_TILE = 48;
export const FLOOR_TILE = 40;

export class CameraController {
  minZoom = 0.4;
  maxZoom = 2.2;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private worldW = 0;
  private worldH = 0;
  /** Screen-space padding reserved for the HUD (top bar / bottom palette). */
  padTop = 60;
  padBottom = 118;
  padBottomCollapsed = 56;
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
  fit(paletteOpen: boolean): { collapsePalette: boolean } {
    this.lastMode = 'yard';
    return this.fitRect(0, 0, this.worldW, this.worldH, paletteOpen, false);
  }

  /**
   * Default framing: the part of the yard that is in use (structures plus a margin),
   * so a first chain fills the screen instead of floating in empty lawn. Zoom is capped
   * so tiles never exceed 96 px; the player can still Fit the whole yard.
   */
  frameUsed(used: { x: number; y: number; w: number; h: number }, paletteOpen: boolean): { collapsePalette: boolean } {
    this.lastMode = 'used';
    this.lastUsed = used;
    return this.fitRect(used.x * TILE, used.y * TILE, used.w * TILE, used.h * TILE, paletteOpen, true);
  }

  /** Width of the tip/order cards at this window width (mirrors src/ui/styles.css). */
  private cardWidth(vw: number): number {
    if (vw <= 1050) return 212;
    if (vw <= 1150) return 232;
    return 264;
  }

  reframe(paletteOpen: boolean): { collapsePalette: boolean } {
    if (this.lastMode === 'used' && this.lastUsed) return this.frameUsed(this.lastUsed, paletteOpen);
    return this.fit(paletteOpen);
  }

  private fitRect(rx: number, ry: number, rw: number, rh: number, paletteOpen: boolean, capZoom: boolean): { collapsePalette: boolean } {
    const vw = this.scene.scale.width;
    const vh = this.scene.scale.height;
    const w = rw + TILE * 0.2;
    const h = rh + TILE * 0.2;
    // Frame inside the column between the side cards (card widths follow the CSS breakpoints),
    // so the framed area never sits under the tip or order card. The 40 px floor still wins.
    const gutters = this.cardWidth(vw) + 16;
    const zoomFor = (padBottom: number) => Math.min((vw - 2 * gutters) / w, (vh - this.padTop - padBottom) / h);
    let collapse = false;
    let padBottom = paletteOpen ? this.padBottom : this.padBottomCollapsed;
    let zoom = zoomFor(padBottom);
    if (paletteOpen && zoom * TILE < MIN_DEFAULT_TILE) {
      collapse = true;
      padBottom = this.padBottomCollapsed;
      zoom = zoomFor(padBottom);
    }
    zoom = Phaser.Math.Clamp(zoom, FLOOR_TILE / TILE, capZoom ? 1.5 : this.maxZoom);
    this.cam.setZoom(zoom);
    const offsetY = (this.padTop - padBottom) / 2 / zoom;
    this.cam.centerOn(rx + rw / 2, ry + rh / 2 + offsetY);
    this.clamp();
    return { collapsePalette: collapse };
  }

  centerOnGarden(padBottom = this.padBottom): void {
    const offsetY = (this.padTop - padBottom) / 2 / this.cam.zoom;
    this.cam.centerOn(this.worldW / 2, this.worldH / 2 + offsetY);
    this.clamp();
  }

  zoomAt(screenX: number, screenY: number, factor: number): void {
    const before = this.cam.getWorldPoint(screenX, screenY);
    const zoom = Phaser.Math.Clamp(this.cam.zoom * factor, this.minZoom, this.maxZoom);
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
    const marginX = this.padTop / z;
    const top = view.y + this.padTop / z;
    const bottom = view.bottom - this.padBottom / z;
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
