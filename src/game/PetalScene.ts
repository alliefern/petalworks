import Phaser from 'phaser';
import { FACING_ANGLE, bedKey, itemKey, machineKey, packingKey, paletteKey, type BedState, type MachineState } from '../assets/manifest';
import { audio } from '../app/audio';
import type { GameStore } from '../app/store';
import { BELT_TICKS } from '../sim/data/balance';
import { PLOTS, tilesOf } from '../sim/data/plots';
import { STRUCTURES } from '../sim/data/structures';
import { DX, DY, dirBetween, isOpenTile, opposite, rotateCCW, rotateCW } from '../sim/grid';
import type { Dir, SimEvent, Structure, World } from '../sim/types';
import { CameraController } from './camera';
import { COLORS, DEPTH, TILE } from './constants';
import { placeLabelInView, type ScreenBox } from './labelPlace';
import { DISC_SIZE, makeOverlayTextures } from './overlays';
import { beltProgressT, itemPositionOnBelt, tileCenter } from './paths';
import { SpriteRegistry } from './sprites';
import { offset, organicOutline, resample } from './outline';
import { COPY, fmt } from '../ui/strings';

interface StructureView {
  id: number;
  main: Phaser.GameObjects.Image;
  endcap: Phaser.GameObjects.Image;
  arrow: Phaser.GameObjects.Image;
  pennant: Phaser.GameObjects.Image;
  disc: Phaser.GameObjects.Image;
  /** Signature of the last applied belt appearance (frame, shape, endcap); unchanged belts are skipped. */
  beltSig: string;
  /** Cached feeder directions and the layout version they were computed for. */
  feeders: Dir[];
  feedersAt: number;
  /** Facing the arrow was last placed for. */
  arrowFacing: number;
  sized: boolean;
}

interface ItemView {
  outline: Phaser.GameObjects.Image;
  sprite: Phaser.GameObjects.Image;
}

const BELT_FRAME_RATE = 8 / BELT_TICKS; // frames per tick so chevrons keep pace with items
const STRUCTURE_SIZE = TILE * 1.125;

export class PetalScene extends Phaser.Scene {
  readonly sprites = new SpriteRegistry();
  private store!: GameStore;
  private camCtl!: CameraController;
  private ground: Phaser.GameObjects.Image[] = [];
  private lockedGfx: Phaser.GameObjects.Graphics[] = [];
  private lockedText: Phaser.GameObjects.Text[] = [];
  private groundKey = '';
  private views = new Map<number, StructureView>();
  private items = new Map<number, ItemView>();
  private ghost!: Phaser.GameObjects.Image;
  private ghostRing!: Phaser.GameObjects.Image;
  private ghostArrow!: Phaser.GameObjects.Image;
  private ghostBelts: Phaser.GameObjects.Image[] = [];
  private selectRing!: Phaser.GameObjects.Image;
  private hoverRing!: Phaser.GameObjects.Image;
  private cursorRing!: Phaser.GameObjects.Image;
  private dragging: null | { mode: 'pan' | 'belt' | 'maybe-pan'; startX: number; startY: number; lastX: number; lastY: number; moved: boolean } = null;
  private lastHover: { x: number; y: number } | null = null;
  private lastCursorKey = '';
  private labels = new Map<number, Phaser.GameObjects.Container>();
  private petals?: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkles?: Phaser.GameObjects.Particles.ParticleEmitter;
  ready = false;

  constructor() {
    super('petal');
  }

  init(data: { store: GameStore }): void {
    this.store = data.store;
  }

  preload(): void {
    this.load.on('progress', (p: number) => this.store.setUi({ loadProgress: p }));
    this.sprites.preload(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.linen);
    if (!this.textures.exists('__MISSING')) {
      const g = this.add.graphics();
      g.fillStyle(0xff00ff, 1);
      g.fillRect(0, 0, 8, 8);
      g.generateTexture('__MISSING', 8, 8);
      g.destroy();
    }
    makeOverlayTextures(this);
    this.camCtl = new CameraController(this);
    this.camCtl.setWorldSize(this.store.sim.world.cols, this.store.sim.world.rows);
    this.frameUsedArea();

    const mk = (key: string, depth: number) => this.add.image(0, 0, key).setDepth(depth).setVisible(false).setDisplaySize(TILE, TILE);
    this.ghostRing = mk('ring.valid', DEPTH.ghost);
    this.ghost = this.add.image(0, 0, '__MISSING').setDepth(DEPTH.ghost + 1).setAlpha(0.7).setVisible(false);
    this.ghostArrow = this.add.image(0, 0, 'arrow.exit').setDepth(DEPTH.ghost + 2).setVisible(false).setDisplaySize(14, 12);
    this.selectRing = mk('ring.select', DEPTH.badge);
    this.hoverRing = mk('ring.valid', DEPTH.ghost - 1);
    this.cursorRing = mk('ring.cursor', DEPTH.badge + 1);

    this.petals = this.add
      .particles(0, 0, this.tex('fx.petal.pink'), {
        frame: this.sprites.get('fx.petal.pink').frame,
        lifespan: { min: 1200, max: 2200 },
        speed: { min: 40, max: 160 },
        angle: { min: 200, max: 340 },
        gravityY: 90,
        rotate: { start: 0, end: 360 },
        scale: { start: 0.5, end: 0.2 },
        alpha: { start: 1, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.fx);
    this.sparkles = this.add
      .particles(0, 0, this.tex('fx.sparkle'), {
        frame: this.sprites.get('fx.sparkle').frame,
        lifespan: { min: 300, max: 600 },
        speed: { min: 10, max: 60 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.fx);

    this.setupInput();
    this.scale.on('resize', () => this.applyFit(this.camCtl.reframe(this.store.ui.paletteOpen)));
    (window as unknown as { __cam?: unknown; __scene?: unknown }).__cam = this.cameras.main;
    (window as unknown as { __scene?: unknown }).__scene = this;
    this.ready = true;
  }

  tex(key: string): string {
    return this.sprites.get(key).texture;
  }

  /** Create an image from a semantic key (atlas frame or stand-alone texture). */
  private img(x: number, y: number, key: string): Phaser.GameObjects.Image {
    const ref = this.sprites.get(key);
    return this.add.image(x, y, ref.texture, ref.frame);
  }

  private setImage(img: Phaser.GameObjects.Image, key: string, extraAngle = 0): void {
    const ref = this.sprites.get(key);
    if (img.texture.key !== ref.texture || (ref.frame !== undefined && img.frame.name !== ref.frame)) img.setTexture(ref.texture, ref.frame);
    img.setAngle(ref.angle + extraAngle);
  }

  // ---- ground -------------------------------------------------------------------------
  private rebuildGround(world: World): void {
    const showLocked = world.expansionUnlocked;
    const key = `${world.cols}x${world.rows}:${world.unlockedPlotIds.join(',')}:${showLocked}`;
    if (this.groundKey === key) return;
    this.groundKey = key;
    for (const g of this.ground) g.destroy();
    this.ground = [];
    for (const g of this.lockedGfx) g.destroy();
    this.lockedGfx = [];
    for (const t of this.lockedText) t.destroy();
    this.lockedText = [];
    const seeded = (x: number, y: number) => {
      const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    // Ground tiles overlap by a hair so fractional camera zoom never shows seams.
    const put = (key: string, x: number, y: number, depth: number = DEPTH.ground, scale = 1) => {
      const c = tileCenter(x, y);
      const im = this.img(c.x, c.y, key).setDepth(depth);
      im.setDisplaySize(TILE * scale + 1, TILE * scale + 1);
      this.ground.push(im);
      return im;
    };
    const open = (x: number, y: number) => isOpenTile(world, x, y);
    const openTiles = tilesOf(world.unlockedPlotIds);
    const openSet = new Set(openTiles.map((t) => `${t.x},${t.y}`));

    // Closed plots (the expansion before it is bought).
    const closedTiles: Array<{ x: number; y: number; cost: number }> = [];
    if (showLocked) {
      for (const p of PLOTS) {
        if (!p.purchasable || world.unlockedPlotIds.includes(p.id)) continue;
        for (const t of tilesOf([p.id])) if (!open(t.x, t.y)) closedTiles.push({ ...t, cost: p.cost });
      }
    }
    const closedSet = new Set(closedTiles.map((t) => `${t.x},${t.y}`));

    // Lawn: every open tile, every closed-preview tile, and a one-tile apron around them
    // that the border fade will blend into the surroundings.
    const lawn = new Set<string>();
    for (const k of [...openSet, ...closedSet]) {
      const [x, y] = k.split(',').map(Number);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) lawn.add(`${x + dx},${y + dy}`);
    }
    // The organic border: traced around the open tiles, smoothed and wobbled, pushed a
    // little outward so the curve clears the buildable tiles' corners.
    const loops = organicOutline(openTiles, TILE, 7).map((l) => offset(l, TILE * 0.12));
    // The closed preview continues the lawn past the hedge, so the soft fade into the
    // surroundings follows the *outer* edge (open + closed tiles) with the same curve;
    // with nothing closed, the fade sits on the hedge line itself.
    const future = closedTiles.length ? organicOutline([...openTiles, ...closedTiles], TILE, 7).map((l) => offset(l, TILE * 0.12)) : loops;

    // How far past the outer curve the lawn is allowed to show before it is all linen.
    const FADE_REACH = TILE * 0.9;
    // The apron and the closed preview are square tiles, so they are clipped to a smooth
    // outward offset of the curve: no tile-shaped step can ever show beyond it.
    const maskGfx = this.make.graphics({ x: 0, y: 0 }, false);
    maskGfx.fillStyle(0xffffff, 1);
    for (const loop of future) maskGfx.fillPoints(offset(loop, FADE_REACH), true);
    const lawnMask = maskGfx.createGeometryMask();
    this.lockedGfx.push(maskGfx);

    // Open tiles sit above the fade so a fade stroke crossing a narrow bay never shows on
    // buildable lawn; the apron and the closed preview sit below it and melt away.
    for (const k of lawn) {
      const [x, y] = k.split(',').map(Number);
      const r = seeded(x, y);
      const im = put(`ground.grass.${r < 0.72 ? 0 : r < 0.84 ? 1 : r < 0.94 ? 2 : 3}`, x, y, openSet.has(k) ? DEPTH.ground + 0.4 : DEPTH.ground);
      if (!openSet.has(k)) im.setMask(lawnMask);
    }

    const fade = this.add.graphics().setDepth(DEPTH.ground + 0.3);
    const border = this.add.graphics().setDepth(DEPTH.ground + 0.5);
    this.ground.sort((a, b) => a.depth - b.depth);
    for (const loop of future) {
      // Soft fade from the outer curve out to FADE_REACH: abutting linen strokes along
      // outward offsets of the curve, with a smoothstep alpha so the lawn melts into the
      // surroundings and is fully linen exactly where the lawn mask ends.
      // (Strokes, not ring triangles: offsets self-cross at tight bays and triangles would flip.)
      const steps = 18;
      const step = FADE_REACH / steps;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        fade.lineStyle(step * 1.25, COLORS.linen, Math.min(1, t * t * (3 - 2 * t) + 0.02));
        fade.strokePoints(offset(loop, step * (i - 0.5)), true, true);
      }
      // Solid band past the mask edge so its anti-aliased rim and any stray sliver vanish.
      fade.lineStyle(TILE * 0.7, COLORS.linen, 1);
      fade.strokePoints(offset(loop, FADE_REACH + TILE * 0.3), true, true);
    }
    for (const loop of loops) {
      // One continuous painted border: a soft glow, the line, and a thin cream highlight.
      border.lineStyle(14, COLORS.cream, 0.28);
      border.strokePoints(loop, true, true);
      border.lineStyle(4.5, 0x4f6345, 0.95);
      border.strokePoints(loop, true, true);
      border.lineStyle(1.5, COLORS.cream, 0.45);
      border.strokePoints(offset(loop, -2.5), true, true);
      // Hedge: foliage chunks of the hedge art planted along the curve just outside the line.
      const path = offset(loop, TILE * 0.3);
      const spacing = TILE * 0.5;
      const pts = resample(path, spacing);
      pts.forEach((p, i) => {
        const q = pts[(i + 1) % pts.length];
        const ang = Math.atan2(q.y - p.y, q.x - p.x);
        const r = seeded(i, 99);
        const im = this.img(p.x, p.y, 'edge.hedge.n').setDepth(DEPTH.ground + 0.8 + (r < 0.5 ? 0 : 0.01));
        im.setCrop(Math.floor(r * 60), 0, 68, 74);
        im.setDisplaySize(128, 128); // native 2x art; crop keeps a 34×37 CSS px chunk
        im.setScale((0.46 + r * 0.14) * (TILE / 128) * 1.6);
        im.setRotation(ang + Math.PI / 2 * (seeded(i, 5) < 0.5 ? 1 : -1) * 0 + (seeded(i, 11) - 0.5) * 0.6);
        this.ground.push(im);
      });
    }
    this.lockedGfx.push(fade, border);

    // Closed field preview: a tint, the future border as a dotted kraft curve, and one
    // label placed on the closed tile farthest from the field's own edge so it fits inside.
    if (closedTiles.length) {
      // The tint fills the smooth future outline (not tile squares); open tiles sit above
      // it, so only the closed field shows the tint, and its outer edge is the curve.
      const tint = this.add.graphics().setDepth(DEPTH.ground + 0.2);
      tint.fillStyle(COLORS.moss, 0.2);
      for (const loop of future) tint.fillPoints(loop, true);
      const dashed = this.add.graphics().setDepth(DEPTH.ground + 0.55);
      this.lockedGfx.push(dashed);
      for (const loop of future) {
        const pts = resample(loop, 10);
        dashed.lineStyle(3, 0xc9a978, 0.9);
        for (let i = 0; i < pts.length; i += 2) {
          const a = pts[i];
          const b = pts[(i + 1) % pts.length];
          dashed.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
      this.lockedGfx.push(tint);
      let best = closedTiles[0];
      let bestD = -1;
      for (const t of closedTiles) {
        // Chebyshev distance to the nearest tile that is not part of the closed field.
        let d = 0;
        outer: for (d = 1; d < 6; d++) {
          for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) if (!closedSet.has(`${t.x + dx},${t.y + dy}`)) break outer;
        }
        if (d > bestD) {
          bestD = d;
          best = t;
        }
      }
      const lx = (best.x + 0.5) * TILE;
      const ly = (best.y + 0.5) * TILE;
      const label = this.add
        .text(lx, ly, `${COPY.expansion.button}\n${fmt(COPY.expansion.confirmCost, { cost: best.cost })}`, {
          fontFamily: 'Nunito, "Segoe UI", sans-serif',
          fontSize: '15px',
          fontStyle: '800',
          color: '#39463b',
          align: 'center',
          backgroundColor: 'rgba(246,235,213,0.92)',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setDepth(DEPTH.ground + 0.9);
      label.setData('homeX', lx);
      label.setData('homeY', ly);
      this.lockedText.push(label);
    }

    // Decorative accents on open lawn, plus props resting just outside the border.
    const decor: Array<[string, number, number, number]> = [
      ['decor.wildflower.0', 3, 2, 0.5],
      ['decor.tuft.0', 12, 3, 0.5],
      ['decor.stone.0', 2, 8, 0.5],
      ['decor.mushroom.0', 13, 9, 0.5],
      ['decor.tuft.0', 7, 11, 0.5],
      ['decor.wildflower.0', 10, 2, 0.5],
    ];
    for (const [k, x, y, scale] of decor) {
      if (!open(x, y)) continue;
      const im = put(k, x, y, DEPTH.decor, 1);
      im.setDisplaySize(TILE * scale, TILE * scale);
      im.setPosition(x * TILE + TILE * 0.75, y * TILE + TILE * 0.3);
    }
    for (const [k, x, y, sc] of [
      ['decor.terracotta', 0, 1, 0.85],
      ['decor.watering_can', 19, 6, 0.9],
    ] as Array<[string, number, number, number]>) {
      if (open(x, y) || closedSet.has(`${x},${y}`)) continue;
      const im = put(k, x, y, DEPTH.decor + 1, sc);
      im.setPosition((x + 0.5) * TILE, (y + 0.5) * TILE);
    }
    this.camCtl.setWorldSize(world.cols, world.rows);
  }

  // ---- structures ---------------------------------------------------------------------
  private syncStructures(world: World, simTime: number): void {
    const alive = new Set<number>();
    for (const s of Object.values(world.structures)) {
      alive.add(s.id);
      let v = this.views.get(s.id);
      if (!v) {
        v = this.createView(s);
        this.views.set(s.id, v);
      }
      this.updateView(v, s, world, simTime);
    }
    for (const [id, v] of this.views) {
      if (!alive.has(id)) {
        this.puff(v.main.x, v.main.y);
        for (const o of [v.main, v.endcap, v.arrow, v.pennant, v.disc]) o.destroy();
        this.views.delete(id);
      }
    }
  }

  private createView(s: Structure): StructureView {
    const c = tileCenter(s.x, s.y);
    const main = this.add.image(c.x, c.y, '__MISSING');
    const endcap = this.img(c.x, c.y, 'belt.end').setVisible(false).setDepth(DEPTH.belt + 1);
    endcap.setDisplaySize(TILE, TILE);
    const arrow = this.add.image(c.x, c.y, 'arrow.exit').setDepth(DEPTH.item - 1).setDisplaySize(14, 12);
    const pennant = this.img(c.x, c.y, 'badge.blocked').setVisible(false).setDepth(DEPTH.badge);
    pennant.setDisplaySize(TILE * 0.5, TILE * 0.5);
    const disc = this.add.image(c.x, c.y, 'disc.blocked').setVisible(false).setDepth(DEPTH.badge + 1);
    disc.setDisplaySize(DISC_SIZE, DISC_SIZE);
    const v: StructureView = { id: s.id, main, endcap, arrow, pennant, disc, beltSig: '', feeders: [], feedersAt: -1, arrowFacing: -1, sized: false };
    if (!this.store.reducedMotion) {
      main.setScale(0.6);
      this.tweens.add({ targets: main, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
    }
    return v;
  }

  private feedersCached(v: StructureView, s: Structure): Dir[] {
    const lv = this.store.layoutVersion;
    if (v.feedersAt !== lv) {
      v.feeders = this.feeders(s);
      v.feedersAt = lv;
    }
    return v.feeders;
  }

  private feeders(s: Structure): Dir[] {
    const out: Dir[] = [];
    for (const d of [0, 1, 2, 3] as Dir[]) {
      const n = this.store.sim.at(s.x + DX[d], s.y + DY[d]);
      if (!n) continue;
      if (STRUCTURES[n.kind].role === 'packing') continue;
      if (n.facing === opposite(d)) out.push(d);
    }
    return out;
  }

  private placeBadge(v: StructureView, c: { x: number; y: number }, discKey: string | null, pennantKey: string | null, simTime: number): void {
    if (!discKey) {
      v.disc.setVisible(false);
      v.pennant.setVisible(false);
      return;
    }
    const bob = this.store.reducedMotion ? 0 : Math.sin(simTime / 220) * 1.5;
    const inv = 1 / this.cameras.main.zoom; // keep the disc 28 CSS px at any zoom
    const x = c.x + TILE * 0.34;
    const y = c.y - TILE * 0.34 + bob;
    if (pennantKey && this.sprites.has(pennantKey)) {
      this.setImage(v.pennant, pennantKey);
      v.pennant.setVisible(true).setPosition(x, y + 6 * inv).setDisplaySize(TILE * 0.5 * inv, TILE * 0.5 * inv);
    } else v.pennant.setVisible(false);
    if (v.disc.texture.key !== discKey) v.disc.setTexture(discKey);
    v.disc.setVisible(true).setPosition(x, y).setDisplaySize(DISC_SIZE * inv, DISC_SIZE * inv);
  }

  private updateView(v: StructureView, s: Structure, world: World, simTime: number): void {
    const c = tileCenter(s.x, s.y);
    const def = STRUCTURES[s.kind];
    if (!v.sized) {
      // Structures never move and each role has one size: set these once.
      v.main.setPosition(c.x, c.y);
      v.endcap.setPosition(c.x, c.y);
      if (s.kind === 'belt') v.main.setDisplaySize(TILE, TILE).setDepth(DEPTH.belt);
      else v.main.setDisplaySize(STRUCTURE_SIZE, STRUCTURE_SIZE).setDepth(DEPTH.structure + s.y * 0.01);
      v.sized = true;
    }
    const tick = world.tick;
    const reduced = this.store.reducedMotion;
    let disc: string | null = null;
    let pennant: string | null = null;

    if (s.kind === 'belt') {
      const frame = reduced ? 0 : Math.floor((simTime / 100) * BELT_FRAME_RATE) % 8;
      const feeders = this.feedersCached(v, s);
      const sig = `${frame}|${s.facing}|${feeders.join('')}|${this.store.layoutVersion}`;
      if (sig !== v.beltSig) {
        v.beltSig = sig;
        const behind = opposite(s.facing);
        const left = rotateCCW(s.facing);
        const right = rotateCW(s.facing);
        let key: string;
        let angle: number;
        if (feeders.includes(behind) || feeders.length === 0 || (feeders.includes(left) && feeders.includes(right))) {
          key = `belt.straight.${frame}`;
          angle = FACING_ANGLE[s.facing];
        } else if (feeders.includes(right)) {
          key = `belt.corner.cw.${frame}`;
          angle = (s.facing - 2) * 90;
        } else {
          key = `belt.corner.ccw.${frame}`;
          angle = s.facing * 90;
        }
        this.setImage(v.main, key, angle);
        const ahead = this.store.sim.at(s.x + DX[s.facing], s.y + DY[s.facing]);
        v.endcap.setVisible(!ahead).setAngle(FACING_ANGLE[s.facing]);
      }
      const st = s.belt!;
      if (st.item && st.stuckTicks > 8 && st.block !== 'queue' && st.block !== 'none') {
        disc = st.block === 'wrong_item' ? 'disc.wrong' : 'disc.blocked';
        pennant = st.block === 'wrong_item' ? 'badge.wrong' : 'badge.blocked';
      }
    } else if (def.role === 'producer') {
      const p = s.producer!;
      const ratio = p.growTicks / def.growTicks!;
      const state: BedState = p.output ? 'ready' : ratio < 0.34 ? 'empty' : ratio < 0.7 ? 'grow0' : 'grow1';
      this.setImage(v.main, bedKey(s.kind, s.facing, state));
      if (p.blockedTicks > 3) {
        disc = 'disc.blocked';
        pennant = 'badge.blocked';
      } else if (p.output) {
        disc = 'disc.ready';
        pennant = 'badge.ready';
      }
    } else if (def.role === 'processor') {
      const m = s.processor!;
      let state: MachineState;
      if (m.workTicks !== null) {
        const f = reduced ? 0 : Math.floor(simTime / 180) % 4;
        state = `work${f}` as MachineState;
      } else if (m.outputs.length > 0) state = 'ready';
      else state = 'idle';
      this.setImage(v.main, machineKey(s.kind, s.facing, state));
      if (m.blockedTicks > 3) {
        disc = 'disc.blocked';
        pennant = 'badge.blocked';
      } else if (m.lastRefusedTick >= 0 && tick - m.lastRefusedTick < 15) {
        disc = 'disc.wrong';
        pennant = 'badge.wrong';
      } else if (m.outputs.length > 0) {
        disc = 'disc.ready';
        pennant = 'badge.ready';
      } else if (m.workTicks === null && m.inputs.length > 0) {
        disc = 'disc.waiting';
        pennant = 'badge.waiting';
      }
    } else {
      const pk = s.packing!;
      const since = tick - pk.lastReceivedTick;
      let state: 'idle' | 'receive0' | 'receive1' | 'receive2' | 'receive3' = 'idle';
      if (pk.lastReceivedTick >= 0 && since < 8) {
        state = reduced ? (since < 3 ? 'receive0' : 'idle') : (`receive${Math.min(3, Math.floor(since / 2))}` as typeof state);
      }
      this.setImage(v.main, packingKey(state));
    }

    // Ink exit arrow on the facing edge of everything that outputs (constant 14×12 CSS px).
    if (def.hasFacing) {
      const d = s.facing;
      const inv = 1 / this.cameras.main.zoom;
      const arrowKey = d * 1000 + Math.round(inv * 100);
      if (v.arrowFacing !== arrowKey) {
        v.arrowFacing = arrowKey;
        v.arrow.setVisible(true).setPosition(c.x + DX[d] * (TILE / 2 - 7 * inv), c.y + DY[d] * (TILE / 2 - 7 * inv)).setAngle(FACING_ANGLE[d]).setDisplaySize(14 * inv, 12 * inv);
      }
    } else v.arrow.setVisible(false);

    this.placeBadge(v, c, disc, pennant, simTime);
  }

  // ---- items --------------------------------------------------------------------------
  private syncItems(world: World, alpha: number): void {
    const alive = new Set<number>();
    for (const s of Object.values(world.structures)) {
      if (s.kind !== 'belt' || !s.belt!.item) continue;
      const item = s.belt!.item;
      alive.add(item.id);
      let v = this.items.get(item.id);
      if (!v) {
        const outline = this.img(0, 0, itemKey(item.kind)).setDepth(DEPTH.item).setTintFill(COLORS.ink);
        outline.setDisplaySize(TILE * 0.5 + 2, TILE * 0.5 + 2);
        const sprite = this.img(0, 0, itemKey(item.kind)).setDepth(DEPTH.item);
        sprite.setDisplaySize(TILE * 0.5, TILE * 0.5);
        v = { outline, sprite };
        this.items.set(item.id, v);
      }
      const t = beltProgressT(s, alpha);
      const p = itemPositionOnBelt(s, t);
      const depth = DEPTH.item + s.y * 0.01;
      v.outline.setPosition(p.x, p.y).setDepth(depth);
      v.sprite.setPosition(p.x, p.y).setDepth(depth + 0.001);
    }
    for (const [id, v] of this.items) {
      if (!alive.has(id)) {
        v.outline.destroy();
        v.sprite.destroy();
        this.items.delete(id);
      }
    }
  }

  // ---- ghost / selection -----------------------------------------------------------------
  private syncOverlays(world: World): void {
    const ui = this.store.ui;
    const sel = ui.selectedId !== null ? world.structures[ui.selectedId] : null;
    if (sel) {
      const c = tileCenter(sel.x, sel.y);
      this.selectRing.setVisible(true).setPosition(c.x, c.y);
    } else this.selectRing.setVisible(false);

    // Readable at any zoom, and fully on screen, clear of the side cards.
    this.placeLockedLabels();

    if (ui.cursor) {
      const c = tileCenter(ui.cursor.x, ui.cursor.y);
      this.cursorRing.setVisible(true).setPosition(c.x, c.y);
      const k = `${ui.cursor.x},${ui.cursor.y}`;
      if (k !== this.lastCursorKey) {
        this.lastCursorKey = k;
        this.camCtl.ensureTileVisible(ui.cursor.x, ui.cursor.y);
      }
    } else this.cursorRing.setVisible(false);

    for (const g of this.ghostBelts) g.setVisible(false);
    // The ghost follows the pointer, or the keyboard cursor when the pointer is off the garden.
    const target = ui.hover ?? ui.cursor;
    this.hoverRing.setVisible(false);
    this.ghostArrow.setVisible(false);
    if (ui.tool.type === 'build' && target && !ui.dragPath) {
      const check = this.store.sim.canPlace(ui.tool.kind, target.x, target.y);
      const c = tileCenter(target.x, target.y);
      this.ghostRing.setTexture(check.ok ? 'ring.valid' : 'ring.invalid');
      this.ghostRing.setVisible(true).setPosition(c.x, c.y);
      const def = STRUCTURES[ui.tool.kind];
      const key =
        ui.tool.kind === 'belt'
          ? 'belt.straight.0'
          : def.role === 'producer'
            ? bedKey(ui.tool.kind, ui.buildFacing, 'ready')
            : def.role === 'processor'
              ? machineKey(ui.tool.kind, ui.buildFacing, 'idle')
              : paletteKey(ui.tool.kind);
      this.setImage(this.ghost, key, ui.tool.kind === 'belt' ? FACING_ANGLE[ui.buildFacing] : 0);
      const size = ui.tool.kind === 'belt' ? TILE : STRUCTURE_SIZE;
      this.ghost.setVisible(true).setPosition(c.x, c.y).setDisplaySize(size, size).setAlpha(check.ok ? 0.75 : 0.4);
      if (def.hasFacing) {
        const d = ui.buildFacing;
        this.ghostArrow.setVisible(true).setPosition(c.x + DX[d] * (TILE / 2 - 7), c.y + DY[d] * (TILE / 2 - 7)).setAngle(FACING_ANGLE[d]);
      }
    } else if (ui.dragPath && ui.dragPath.length) {
      this.ghost.setVisible(false);
      this.ghostRing.setVisible(false);
      const path = ui.dragPath;
      for (let i = 0; i < path.length; i++) {
        let g = this.ghostBelts[i];
        if (!g) {
          g = this.img(0, 0, 'belt.straight.0').setDepth(DEPTH.ghost).setAlpha(0.7);
          g.setDisplaySize(TILE, TILE);
          this.ghostBelts[i] = g;
        }
        const t = path[i];
        const n = path[i + 1];
        const prev = path[i - 1];
        let facing: Dir | null = n ? dirBetween(t.x, t.y, n.x, n.y) : prev ? dirBetween(prev.x, prev.y, t.x, t.y) : ui.buildFacing;
        if (facing === null) facing = ui.buildFacing;
        const c = tileCenter(t.x, t.y);
        const existing = this.store.sim.at(t.x, t.y);
        const ok = !existing || existing.kind === 'belt';
        g.setVisible(true).setPosition(c.x, c.y).setAngle(FACING_ANGLE[facing]).setAlpha(ok ? 0.7 : 0.25);
      }
    } else {
      this.ghost.setVisible(false);
      this.ghostRing.setVisible(false);
      if (target && (ui.tool.type === 'remove' || ui.tool.type === 'basket')) {
        const t = this.store.sim.at(target.x, target.y);
        const ok = ui.tool.type === 'remove' ? !!t && STRUCTURES[t.kind].removable : !!t && t.kind === 'belt' && !t.belt!.item;
        const c = tileCenter(target.x, target.y);
        this.hoverRing.setTexture(ok ? (ui.tool.type === 'remove' ? 'ring.invalid' : 'ring.valid') : 'ring.invalid');
        this.hoverRing.setVisible(true).setPosition(c.x, c.y).setAlpha(ok ? 0.95 : 0.4);
      }
    }
  }

  /**
   * The closed-field label is anchored on the east plot. Keep the whole label on
   * screen and clear of the HUD cards, and hide it when the anchor has scrolled away.
   */
  private placeLockedLabels(): void {
    if (!this.lockedText.length) return;
    const cam = this.cameras.main;
    const zoom = cam.zoom || 1;
    const view = cam.worldView;
    const screen = { w: this.scale.width, h: this.scale.height };
    const cards = this.labelCards();
    for (const t of this.lockedText) {
      t.setScale(1 / zoom);
      const homeX = (t.getData('homeX') as number | undefined) ?? t.x;
      const homeY = (t.getData('homeY') as number | undefined) ?? t.y;
      const anchor = { x: (homeX - view.x) * zoom, y: (homeY - view.y) * zoom };
      const placed = placeLabelInView(anchor, { w: t.displayWidth * zoom, h: t.displayHeight * zoom }, screen, cards);
      if (!placed) {
        t.setVisible(false);
        continue;
      }
      t.setVisible(true).setPosition(view.x + placed.x / zoom, view.y + placed.y / zoom);
    }
  }

  /** HUD cards the closed-field label must not sit under. */
  private labelCards(): ScreenBox[] {
    const cards: ScreenBox[] = [];
    for (const sel of ['.orderpanel', '.tutorial', '.inspector', '.palette', '.topbar']) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      cards.push({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom });
    }
    return cards;
  }

  // ---- blocked labels (near the building, not a banner) ------------------------------------
  private syncLabels(world: World): void {
    const want = new Map(this.store.ui.blockedLabels.map((b) => [b.id, b]));
    for (const [id, c] of this.labels) {
      if (!want.has(id)) {
        c.destroy();
        this.labels.delete(id);
      }
    }
    const inv = 1 / this.cameras.main.zoom;
    for (const [id, b] of want) {
      const s = world.structures[id];
      if (!s) continue;
      let c = this.labels.get(id);
      if (!c) {
        const text = this.add.text(0, 0, b.text, {
          fontFamily: 'Nunito, "Segoe UI", sans-serif',
          fontSize: '14px',
          color: '#39463b',
          fontStyle: '700',
          wordWrap: { width: 220 },
          align: 'center',
        }).setOrigin(0.5, 0);
        const pad = 8;
        const bg = this.add.graphics();
        bg.fillStyle(COLORS.cream, 0.96);
        bg.lineStyle(2, COLORS.ink, 0.9);
        bg.fillRoundedRect(-text.width / 2 - pad, -pad / 2, text.width + pad * 2, text.height + pad, 8);
        bg.strokeRoundedRect(-text.width / 2 - pad, -pad / 2, text.width + pad * 2, text.height + pad, 8);
        c = this.add.container(0, 0, [bg, text]).setDepth(DEPTH.fx + 1);
        this.labels.set(id, c);
      }
      const t = tileCenter(s.x, s.y);
      c.setPosition(t.x, t.y + TILE * 0.62).setScale(inv);
    }
  }

  // ---- effects ------------------------------------------------------------------------
  private handleEvents(events: SimEvent[], world: World): void {
    const reduced = this.store.reducedMotion;
    for (const e of events) {
      switch (e.type) {
        case 'crafted': {
          const s = world.structures[e.structureId];
          if (s) this.ringPop(s, reduced);
          break;
        }
        case 'item_spawned': {
          const v = this.views.get(e.structureId);
          if (v && !reduced) this.tweens.add({ targets: v.main, scaleX: 1.08, scaleY: 1.08, yoyo: true, duration: 120 });
          break;
        }
        case 'delivered': {
          const s = world.structures[e.structureId];
          if (s && !reduced) {
            const c = tileCenter(s.x, s.y);
            this.sparkles?.explode(6, c.x, c.y - 10);
          }
          break;
        }
        case 'order_complete': {
          if (reduced) break;
          for (const s of Object.values(world.structures)) {
            if (s.kind === 'packing_station') {
              const c = tileCenter(s.x, s.y);
              this.petals?.explode(e.final ? 70 : 26, c.x, c.y);
            }
          }
          this.cameras.main.flash(260, 246, 235, 213, false);
          break;
        }
        case 'placed': {
          const s = world.structures[e.structureId];
          if (s && !reduced) {
            const c = tileCenter(s.x, s.y);
            this.sparkles?.explode(4, c.x, c.y);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  private ringPop(s: Structure, reduced: boolean): void {
    if (reduced) return;
    const c = tileCenter(s.x, s.y);
    const ring = this.img(c.x, c.y, 'fx.ring').setDepth(DEPTH.fx).setDisplaySize(TILE * 0.6, TILE * 0.6).setAlpha(0.9);
    this.tweens.add({ targets: ring, displayWidth: TILE * 1.4, displayHeight: TILE * 1.4, alpha: 0, duration: 380, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const v = this.views.get(s.id);
    if (v) this.tweens.add({ targets: v.main, scaleX: 1.1, scaleY: 1.1, yoyo: true, duration: 110 });
  }

  private puff(x: number, y: number): void {
    if (this.store.reducedMotion) return;
    this.sparkles?.explode(8, x, y);
  }

  // ---- input --------------------------------------------------------------------------
  private tileAtPointer(p: Phaser.Input.Pointer): { x: number; y: number } {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
  }

  private setupInput(): void {
    this.input.mouse?.disableContextMenu();
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const t = this.tileAtPointer(p);
      if (!this.lastHover || this.lastHover.x !== t.x || this.lastHover.y !== t.y) {
        this.lastHover = t;
        const inside = isOpenTile(this.store.sim.world, t.x, t.y);
        this.store.setUi({ hover: inside ? t : null });
        if (this.dragging?.mode === 'belt') this.extendPath(t);
      }
      if (this.dragging) {
        const dx = p.x - this.dragging.lastX;
        const dy = p.y - this.dragging.lastY;
        if (Math.abs(p.x - this.dragging.startX) + Math.abs(p.y - this.dragging.startY) > 6) this.dragging.moved = true;
        if (this.dragging.mode === 'pan' || (this.dragging.mode === 'maybe-pan' && this.dragging.moved)) {
          this.dragging.mode = 'pan';
          this.camCtl.panBy(dx, dy);
        }
        this.dragging.lastX = p.x;
        this.dragging.lastY = p.y;
      }
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      audio.unlock();
      const t = this.tileAtPointer(p);
      const ui = this.store.ui;
      const base = { startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, moved: false };
      if (p.middleButtonDown() || p.rightButtonDown()) {
        this.dragging = { mode: 'maybe-pan', ...base };
        return;
      }
      if (!p.leftButtonDown()) return;
      const inside = isOpenTile(this.store.sim.world, t.x, t.y);
      if (ui.keyPathActive) this.store.setUi({ keyPathActive: false, dragPath: null });
      switch (ui.tool.type) {
        case 'build':
          if (ui.tool.kind === 'belt') {
            if (inside) {
              this.dragging = { mode: 'belt', ...base };
              this.store.setUi({ dragPath: [t] });
            } else this.dragging = { mode: 'maybe-pan', ...base };
          } else if (inside) {
            this.store.dispatch({ type: 'place', kind: ui.tool.kind, x: t.x, y: t.y, facing: ui.buildFacing });
          } else {
            this.store.dispatch({ type: 'place', kind: ui.tool.kind, x: t.x, y: t.y, facing: ui.buildFacing });
            this.dragging = { mode: 'maybe-pan', ...base };
          }
          break;
        case 'remove': {
          const target = inside ? this.store.sim.at(t.x, t.y) : null;
          if (target) this.store.dispatch({ type: 'remove', id: target.id });
          else this.dragging = { mode: 'maybe-pan', ...base };
          break;
        }
        case 'basket': {
          if (inside) {
            const r = this.store.dispatch({ type: 'basket_drop', kind: ui.tool.kind, x: t.x, y: t.y });
            if (r.ok && !(this.store.sim.world.basket[ui.tool.kind] ?? 0)) this.store.setTool({ type: 'select' });
          } else this.dragging = { mode: 'maybe-pan', ...base };
          break;
        }
        case 'select': {
          const target = inside ? this.store.sim.at(t.x, t.y) : null;
          if (target) this.store.select(target.id);
          this.dragging = { mode: 'maybe-pan', ...base };
          break;
        }
      }
    });

    const finish = (p: Phaser.Input.Pointer) => {
      const d = this.dragging;
      this.dragging = null;
      if (!d) return;
      if (d.mode === 'belt') {
        const path = this.store.ui.dragPath ?? [];
        this.store.setUi({ dragPath: null });
        if (path.length === 1) {
          this.store.dispatch({ type: 'place', kind: 'belt', x: path[0].x, y: path[0].y, facing: this.store.ui.buildFacing });
        } else if (path.length > 1) {
          this.store.dispatch({ type: 'place_belt_path', tiles: path });
        }
        return;
      }
      if (d.mode === 'maybe-pan' && !d.moved) {
        if (p.button === 2) {
          // Right-click cancels the tool, then clears the selection.
          this.store.cancel();
        } else if (p.button === 0 && this.store.ui.tool.type === 'select') {
          const t = this.tileAtPointer(p);
          if (!this.store.sim.at(t.x, t.y)) this.store.select(null);
        }
      }
    };
    this.input.on('pointerup', finish);
    this.input.on('pointerupoutside', finish);
    this.input.on('gameout', () => {
      if (this.dragging?.mode === 'belt') return;
      this.dragging = null;
      this.lastHover = null;
      this.store.setUi({ hover: null });
    });

    this.input.on('wheel', (p: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
      this.camCtl.zoomAt(p.x, p.y, dy > 0 ? 0.9 : 1.1);
    });
  }

  private extendPath(t: { x: number; y: number }): void {
    if (!isOpenTile(this.store.sim.world, t.x, t.y)) return;
    const path = [...(this.store.ui.dragPath ?? [])];
    const idx = path.findIndex((q) => q.x === t.x && q.y === t.y);
    if (idx >= 0) {
      path.length = idx + 1;
      this.store.setUi({ dragPath: path });
      return;
    }
    let last = path[path.length - 1];
    if (!last) {
      this.store.setUi({ dragPath: [t] });
      return;
    }
    // Walk an L-shaped route if the pointer skipped tiles.
    let guard = 0;
    while ((last.x !== t.x || last.y !== t.y) && guard++ < 64) {
      const nx = last.x !== t.x ? last.x + Math.sign(t.x - last.x) : last.x;
      const ny = last.x === t.x && last.y !== t.y ? last.y + Math.sign(t.y - last.y) : last.y;
      last = { x: nx, y: ny };
      const j = path.findIndex((q) => q.x === last.x && q.y === last.y);
      if (j >= 0) path.length = j + 1;
      else path.push(last);
    }
    this.store.setUi({ dragPath: path });
  }

  // ---- public controls used by the HUD -------------------------------------------------
  private applyFit(r: { collapsePalette: boolean }): void {
    if (r.collapsePalette && this.store.ui.paletteOpen) this.store.setUi({ paletteOpen: false });
  }

  /** Fit the whole yard (Fit button / Home). */
  recenter(): void {
    this.applyFit(this.camCtl.fit(this.store.ui.paletteOpen));
  }

  /**
   * Default framing: the structures' bounding box plus a 2-tile margin, never smaller than
   * 10×7 tiles, pulled toward the Packing Station so the first chain fills the screen.
   */
  frameUsedArea(): void {
    const w = this.store.sim.world;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const s of Object.values(w.structures)) {
      minX = Math.min(minX, s.x);
      minY = Math.min(minY, s.y);
      maxX = Math.max(maxX, s.x);
      maxY = Math.max(maxY, s.y);
    }
    if (!Number.isFinite(minX)) {
      minX = maxX = Math.floor(w.cols / 2);
      minY = maxY = Math.floor(w.rows / 2);
    }
    const margin = 2;
    let x0 = minX - margin;
    let y0 = minY - margin;
    let x1 = maxX + margin + 1;
    let y1 = maxY + margin + 1;
    const minW = 10;
    const minH = 7;
    if (x1 - x0 < minW) {
      const cx = (x0 + x1) / 2;
      x0 = cx - minW / 2;
      x1 = cx + minW / 2;
    }
    if (y1 - y0 < minH) {
      const cy = (y0 + y1) / 2;
      y0 = cy - minH / 2;
      y1 = cy + minH / 2;
    }
    x0 = Math.max(-1, x0);
    y0 = Math.max(-1, y0);
    x1 = Math.min(w.cols + 1, x1);
    y1 = Math.min(w.rows + 1, y1);
    this.applyFit(this.camCtl.frameUsed({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, this.store.ui.paletteOpen));
  }

  zoomBy(f: number): void {
    this.camCtl.zoomAt(this.scale.width / 2, this.scale.height / 2, f);
  }

  // ---- frame ----------------------------------------------------------------------------
  update(): void {
    if (!this.ready || this.store.ui.screen !== 'game') return;
    const world = this.store.sim.world;
    this.rebuildGround(world);
    const simTime = this.store.ui.simTimeMs;
    this.syncStructures(world, simTime);
    this.syncItems(world, this.store.alpha);
    this.syncOverlays(world);
    this.syncLabels(world);
    this.handleEvents(this.store.drainEvents(), world);
  }
}
