import Phaser from 'phaser';
import { TILE } from './constants';

export class CameraController {
  minZoom = 0.45;
  maxZoom = 2.2;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private worldW = 0;
  private worldH = 0;
  /** Screen-space padding reserved for the HUD (top bar / bottom palette). */
  padTop = 60;
  padBottom = 110;

  constructor(private scene: Phaser.Scene) {
    this.cam = scene.cameras.main;
  }

  setWorldSize(tilesW: number, tilesH: number): void {
    this.worldW = tilesW * TILE;
    this.worldH = tilesH * TILE;
  }

  /** Fit the garden plus its hedge into the viewport. */
  fit(): void {
    const vw = this.scene.scale.width;
    const vh = this.scene.scale.height - this.padTop - this.padBottom;
    const w = this.worldW + TILE * 2.2;
    const h = this.worldH + TILE * 1.6;
    const zoom = Phaser.Math.Clamp(Math.min(vw / w, vh / h), this.minZoom, this.maxZoom);
    this.cam.setZoom(zoom);
    this.centerOnGarden();
  }

  centerOnGarden(): void {
    const offsetY = (this.padTop - this.padBottom) / 2 / this.cam.zoom;
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
