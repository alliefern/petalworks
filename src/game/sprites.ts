import type Phaser from 'phaser';
import { allSpriteKeys, atlasSheetFor, atlasSheets, eastFallbackKey, INTERIM_STEMS, keyToStem, resolveSprite } from '../assets/manifest';

export interface SpriteRef {
  texture: string;
  /** Atlas frame name, or undefined for a stand-alone texture. */
  frame?: string;
  angle: number;
  interim: boolean;
}

/**
 * Maps semantic keys to loaded Phaser textures. Sprites come from the build-time WebP
 * atlases (one texture per sheet, frame per file stem); anything not in an atlas loads
 * as its own image. Each unique URL is loaded once.
 */
export class SpriteRegistry {
  private refs = new Map<string, SpriteRef>();
  private urlToTexture = new Map<string, string>();
  missing: string[] = [];
  interimCount = 0;

  preload(scene: Phaser.Scene): void {
    for (const sheet of atlasSheets()) {
      if (sheet.imageUrl && sheet.dataUrl) scene.load.atlas(sheet.name, sheet.imageUrl, sheet.dataUrl);
    }
    for (const key of allSpriteKeys()) {
      const stem = keyToStem(key);
      const fb = eastFallbackKey(key);
      const direct = atlasSheetFor(stem);
      const viaEast = !direct && fb ? atlasSheetFor(keyToStem(fb.key)) : undefined;
      if (direct || viaEast) {
        const frame = direct ? stem : keyToStem(fb!.key);
        const interim = INTERIM_STEMS.includes(frame);
        if (interim) this.interimCount++;
        this.refs.set(key, { texture: (direct ?? viaEast)!, frame, angle: direct ? 0 : fb!.angle, interim });
        continue;
      }
      const r = resolveSprite(key);
      if (!r) {
        this.missing.push(key);
        continue;
      }
      let texture = this.urlToTexture.get(r.url);
      if (!texture) {
        texture = key;
        this.urlToTexture.set(r.url, texture);
        scene.load.image(texture, r.url);
      }
      if (r.interim) this.interimCount++;
      this.refs.set(key, { texture, angle: r.angle, interim: r.interim });
    }
  }

  get(key: string): SpriteRef {
    const r = this.refs.get(key);
    if (!r) return { texture: '__MISSING', angle: 0, interim: true };
    return r;
  }

  has(key: string): boolean {
    return this.refs.has(key);
  }
}
