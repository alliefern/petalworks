import Phaser from 'phaser';
import { FACING_ANGLE, bedKey, itemKey, machineKey, packingKey, paletteKey, type BedState, type MachineState } from '../assets/manifest';
import { audio } from '../app/audio';
import type { GameStore } from '../app/store';
import { BELT_TICKS } from '../sim/data/balance';
import { PLOTS } from '../sim/data/plots';
import { STRUCTURES } from '../sim/data/structures';
import { DX, DY, dirBetween, isOpenTile, opposite, rotateCCW, rotateCW } from '../sim/grid';
import type { Dir, SimEvent, Structure, World } from '../sim/types';
import { CameraController } from './camera';
import { COLORS, DEPTH, TILE } from './constants';
import { DISC_SIZE, makeOverlayTextures } from './overlays';
import { beltProgressT, itemPositionOnBelt, tileCenter } from './paths';
import { SpriteRegistry } from './sprites';

interface StructureView {
  id: number;
  main: Phaser.GameObjects.Image;
  endcap: Phaser.GameObjects.Image;
  arrow: Phaser.GameObjects.Image;
  pennant: Phaser.GameObjects.Image;
  disc: Phaser.GameObjects.Image;
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
    this.recenter();

    const mk = (key: string, depth: number) => this.add.image(0, 0, key).setDepth(depth).setVisible(false).setDisplaySize(TILE, TILE);
    this.ghostRing = mk('ring.valid', DEPTH.ghost);
    this.ghost = this.add.image(0, 0, '__MISSING').setDepth(DEPTH.ghost + 1).setAlpha(0.7).setVisible(false);
    this.ghostArrow = this.add.image(0, 0, 'arrow.exit').setDepth(DEPTH.ghost + 2).setVisible(false).setDisplaySize(14, 12);
    this.selectRing = mk('ring.select', DEPTH.badge);
    this.hoverRing = mk('ring.valid', DEPTH.ghost - 1);
    this.cursorRing = mk('ring.cursor', DEPTH.badge + 1);

    this.petals = this.add
      .particles(0, 0, this.tex('fx.petal.pink'), {
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
        lifespan: { min: 300, max: 600 },
        speed: { min: 10, max: 60 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        emitting: false,
      })
      .setDepth(DEPTH.fx);

    this.setupInput();
    this.scale.on('resize', () => this.camCtl.clamp());
    (window as unknown as { __cam?: unknown }).__cam = this.cameras.main;
    this.ready = true;
  }

  tex(key: string): string {
    return this.sprites.get(key).texture;
  }

  private setImage(img: Phaser.GameObjects.Image, key: string, extraAngle = 0): void {
    const ref = this.sprites.get(key);
    if (img.texture.key !== ref.texture) img.setTexture(ref.texture);
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
    const W = world.cols;
    const H = world.rows;
    const seeded = (x: number, y: number) => {
      const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    // Ground tiles overlap by a hair so fractional camera zoom never shows seams.
    const put = (key: string, x: number, y: number, depth: number = DEPTH.ground, scale = 1) => {
      const c = tileCenter(x, y);
      const im = this.add.image(c.x, c.y, this.tex(key)).setDepth(depth);
      im.setDisplaySize(TILE * scale + 1, TILE * scale + 1);
      this.ground.push(im);
      return im;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const r = seeded(x, y);
        const v = r < 0.72 ? 0 : r < 0.84 ? 1 : r < 0.94 ? 2 : 3;
        put(`ground.grass.${v}`, x, y);
      }
    }
    // Closed plots show as wilder grass so the player can see what the expansion opens.
    if (showLocked) {
      for (const p of PLOTS) {
        if (world.unlockedPlotIds.includes(p.id)) continue;
        for (let y = p.rect.y; y < p.rect.y + p.rect.h; y++) {
          for (let x = p.rect.x; x < p.rect.x + p.rect.w; x++) {
            if (isOpenTile(world, x, y)) continue;
            put('ground.locked', x, y);
          }
        }
      }
    }
    // Hedge ring (sits one tile outside the open area).
    for (let x = 0; x < W; x++) {
      put('edge.hedge.n', x, -1);
      put('edge.hedge.s', x, H);
    }
    for (let y = 0; y < H; y++) {
      put('edge.hedge.w', -1, y);
      put('edge.hedge.e', W, y);
    }
    put('edge.hedge.nw', -1, -1);
    put('edge.hedge.ne', W, -1);
    put('edge.hedge.sw', -1, H);
    put('edge.hedge.se', W, H);
    const decor: Array<[string, number, number, number]> = [
      ['decor.wildflower.0', 2, 1, 0.5],
      ['decor.tuft.0', W - 3, 2, 0.5],
      ['decor.stone.0', 1, H - 2, 0.5],
      ['decor.mushroom.0', W - 2, H - 3, 0.5],
      ['decor.tuft.0', 6, H - 1, 0.5],
      ['decor.wildflower.0', W - 6, 0, 0.5],
    ];
    for (const [k, x, y, scale] of decor) {
      const im = put(k, x, y, DEPTH.decor, 1);
      im.setDisplaySize(TILE * scale, TILE * scale);
      im.setPosition(x * TILE + TILE * 0.75, y * TILE + TILE * 0.3);
    }
    const can = put('decor.watering_can', W, H, DEPTH.decor + 1, 0.9);
    can.setPosition(W * TILE + TILE * 0.5, H * TILE + TILE * 0.4);
    const pots = put('decor.terracotta', -1, H, DEPTH.decor + 1, 0.85);
    pots.setPosition(-TILE * 0.5, H * TILE + TILE * 0.45);
    this.camCtl.setWorldSize(W, H);
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
    const endcap = this.add.image(c.x, c.y, this.tex('belt.end')).setVisible(false).setDepth(DEPTH.belt + 1);
    endcap.setDisplaySize(TILE, TILE);
    const arrow = this.add.image(c.x, c.y, 'arrow.exit').setDepth(DEPTH.item - 1).setDisplaySize(14, 12);
    const pennant = this.add.image(c.x, c.y, this.tex('badge.blocked')).setVisible(false).setDepth(DEPTH.badge);
    pennant.setDisplaySize(TILE * 0.5, TILE * 0.5);
    const disc = this.add.image(c.x, c.y, 'disc.blocked').setVisible(false).setDepth(DEPTH.badge + 1);
    disc.setDisplaySize(DISC_SIZE, DISC_SIZE);
    const v: StructureView = { id: s.id, main, endcap, arrow, pennant, disc };
    if (!this.store.reducedMotion) {
      main.setScale(0.6);
      this.tweens.add({ targets: main, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut' });
    }
    return v;
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
    const x = c.x + TILE * 0.32;
    const y = c.y - TILE * 0.32 + bob;
    if (pennantKey && this.sprites.has(pennantKey)) {
      this.setImage(v.pennant, pennantKey);
      v.pennant.setVisible(true).setPosition(x, y + 4);
    } else v.pennant.setVisible(false);
    if (v.disc.texture.key !== discKey) v.disc.setTexture(discKey);
    v.disc.setVisible(true).setPosition(x, y);
  }

  private updateView(v: StructureView, s: Structure, world: World, simTime: number): void {
    const c = tileCenter(s.x, s.y);
    v.main.setPosition(c.x, c.y);
    const def = STRUCTURES[s.kind];
    const tick = world.tick;
    const reduced = this.store.reducedMotion;
    let disc: string | null = null;
    let pennant: string | null = null;

    if (s.kind === 'belt') {
      const frame = reduced ? 0 : Math.floor((simTime / 100) * BELT_FRAME_RATE) % 8;
      const feeders = this.feeders(s);
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
      v.main.setDisplaySize(TILE, TILE).setDepth(DEPTH.belt);
      const ahead = this.store.sim.at(s.x + DX[s.facing], s.y + DY[s.facing]);
      v.endcap.setVisible(!ahead).setPosition(c.x, c.y).setAngle(FACING_ANGLE[s.facing]);
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
      v.main.setDisplaySize(STRUCTURE_SIZE, STRUCTURE_SIZE).setDepth(DEPTH.structure + s.y * 0.01);
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
      v.main.setDisplaySize(STRUCTURE_SIZE, STRUCTURE_SIZE).setDepth(DEPTH.structure + s.y * 0.01);
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
      v.main.setDisplaySize(STRUCTURE_SIZE, STRUCTURE_SIZE).setDepth(DEPTH.structure + s.y * 0.01);
    }

    // Ink exit arrow on the facing edge of everything that outputs.
    if (def.hasFacing) {
      const d = s.facing;
      v.arrow.setVisible(true).setPosition(c.x + DX[d] * (TILE / 2 - 7), c.y + DY[d] * (TILE / 2 - 7)).setAngle(FACING_ANGLE[d]);
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
        const tex = this.tex(itemKey(item.kind));
        const outline = this.add.image(0, 0, tex).setDepth(DEPTH.item).setTintFill(COLORS.ink);
        outline.setDisplaySize(TILE * 0.5 + 2, TILE * 0.5 + 2);
        const sprite = this.add.image(0, 0, tex).setDepth(DEPTH.item);
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
          g = this.add.image(0, 0, this.tex('belt.straight.0')).setDepth(DEPTH.ghost).setAlpha(0.7);
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
    const ring = this.add.image(c.x, c.y, this.tex('fx.ring')).setDepth(DEPTH.fx).setDisplaySize(TILE * 0.6, TILE * 0.6).setAlpha(0.9);
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
  recenter(): void {
    const r = this.camCtl.fit(this.store.ui.paletteOpen);
    if (r.collapsePalette && this.store.ui.paletteOpen) this.store.setUi({ paletteOpen: false });
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
    this.handleEvents(this.store.drainEvents(), world);
  }
}
