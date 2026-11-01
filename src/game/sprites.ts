import type Phaser from 'phaser';
import { allSpriteKeys, resolveSprite } from '../assets/manifest';

export interface SpriteRef {
  texture: string;
  angle: number;
  interim: boolean;
}

/** Maps semantic keys to loaded Phaser textures. Each unique URL is loaded once. */
export class SpriteRegistry {
  private refs = new Map<string, SpriteRef>();
  private urlToTexture = new Map<string, string>();
  missing: string[] = [];
  interimCount = 0;

  preload(scene: Phaser.Scene): void {
    for (const key of allSpriteKeys()) {
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
