import Phaser from 'phaser';
import { FACING_ANGLE, bedKey, itemKey, machineKey, packingKey, paletteKey, type BedState, type MachineState } from '../assets/manifest';
import { audio } from '../app/audio';
import type { GameStore } from '../app/store';
import { BELT_TICKS, EXPANDED_GRID } from '../sim/data/balance';
import { STRUCTURES } from '../sim/data/structures';
import { DX, DY, dirBetween, opposite, rotateCCW, rotateCW } from '../sim/grid';
import type { Dir, SimEvent, Structure, World } from '../sim/types';
import { CameraController } from './camera';
import { COLORS, DEPTH, TILE } from './constants';
import { beltProgressT, itemPositionOnBelt, tileCenter } from './paths';
import { SpriteRegistry } from './sprites';

interface StructureView {
  id: number;
  kind: Structure['kind'];
  main: Phaser.GameObjects.Image;
  endcap: Phaser.GameObjects.Image;
  badge: Phaser.GameObjects.Image;
  shadowRing?: Phaser.GameObjects.Image;
  lastKey: string;
  bounceUntil: number;
}

interface ItemView {
  sprite: Phaser.GameObjects.Image;
  kind: string;
}

const BELT_FRAME_RATE = 8 / BELT_TICKS; // frames per tick so chevrons keep pace with items

export class PetalScene extends Phaser.Scene {
  readonly registry2 = new SpriteRegistry();
  private store!: GameStore;
  private camCtl!: CameraController;
  private ground: Phaser.GameObjects.Image[] = [];
  private groundDims = { w: 0, h: 0, locked: false };
  private views = new Map<number, StructureView>();
  private items = new Map<number, ItemView>();
  private ghost!: Phaser.GameObjects.Image;
  private ghostRing!: Phaser.GameObjects.Image;
  private ghostBelts: Phaser.GameObjects.Image[] = [];
  private selectRing!: Phaser.GameObjects.Image;
  private hoverRing!: Phaser.GameObjects.Image;
  private dragging: null | { mode: 'pan' | 'belt' | 'maybe-pan'; startX: number; startY: number; lastX: number; lastY: number; moved: boolean } = null;
  private lastHover: { x: number; y: number } | null = null;
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
    this.registry2.preload(this);
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
    this.camCtl = new CameraController(this);
    this.camCtl.setWorldSize(this.store.sim.world.width, this.store.sim.world.height);
    this.camCtl.fit();

    this.ghostRing = this.add.image(0, 0, this.tex('tile.valid')).setDepth(DEPTH.ghost).setVisible(false);
    this.ghost = this.add.image(0, 0, '__MISSING').setDepth(DEPTH.ghost + 1).setAlpha(0.7).setVisible(false);
    this.selectRing = this.add.image(0, 0, this.tex('tile.select')).setDepth(DEPTH.badge).setVisible(false);
    this.hoverRing = this.add.image(0, 0, this.tex('tile.valid')).setDepth(DEPTH.ghost - 1).setAlpha(0.5).setVisible(false);
    for (const im of [this.ghostRing, this.ghost, this.selectRing, this.hoverRing]) im.setDisplaySize(TILE, TILE);

    this.petals = this.add.particles(0, 0, this.tex('fx.petal.pink'), {
      lifespan: { min: 1200, max: 2200 },
      speed: { min: 40, max: 160 },
      angle: { min: 200, max: 340 },
      gravityY: 90,
      rotate: { start: 0, end: 360 },
      scale: { start: 0.5, end: 0.2 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    }).setDepth(DEPTH.fx);
    this.sparkles = this.add.particles(0, 0, this.tex('fx.sparkle'), {
      lifespan: { min: 300, max: 600 },
      speed: { min: 10, max: 60 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      emitting: false,
    }).setDepth(DEPTH.fx);

    this.setupInput();
    this.scale.on('resize', () => this.camCtl.clamp());
    this.ready = true;
  }

  tex(key: string): string {
    return this.registry2.get(key).texture;
  }

  private setImage(img: Phaser.GameObjects.Image, key: string, extraAngle = 0): void {
    const ref = this.registry2.get(key);
    if (img.texture.key !== ref.texture) img.setTexture(ref.texture);
    img.setAngle(ref.angle + extraAngle);
  }

  // ---- ground -------------------------------------------------------------------------
  private rebuildGround(world: World): void {
    const showLocked = world.expansionUnlocked && !world.expanded;
    if (this.groundDims.w === world.width && this.groundDims.h === world.height && this.groundDims.locked === showLocked) return;
    this.groundDims = { w: world.width, h: world.height, locked: showLocked };
    for (const g of this.ground) g.destroy();
    this.ground = [];
    const W = world.width;
    const H = world.height;
    const seeded = (x: number, y: number) => {
      const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const put = (key: string, x: number, y: number, depth: number = DEPTH.ground, scale = 1) => {
      const c = tileCenter(x, y);
      const im = this.add.image(c.x, c.y, this.tex(key)).setDepth(depth);
      im.setDisplaySize(TILE * scale, TILE * scale);
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
    if (showLocked) {
      for (let y = 0; y < EXPANDED_GRID.height; y++) {
        for (let x = 0; x < EXPANDED_GRID.width; x++) {
          if (x < W && y < H) continue;
          put('ground.locked', x, y);
        }
      }
    }
    // Hedge ring (sits one tile outside the buildable area).
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
    // Decorative accents: a few lawn details and props resting on the hedge corners.
    const decor: Array<[string, number, number, number]> = [
      ['decor.wildflower.0', 2, 1, 0.5],
      ['decor.tuft.0', W - 3, 2, 0.5],
      ['decor.stone.0', 1, H - 2, 0.5],
      ['decor.mushroom.0', W - 2, H - 3, 0.5],
      ['decor.tuft.0', 6, H - 1, 0.5],
      ['decor.wildflower.0', W - 6, 0, 0.5],
    ];
    for (const [key, x, y, scale] of decor) {
      const im = put(key, x, y, DEPTH.decor, 1);
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
        v.main.destroy();
        v.endcap.destroy();
        v.badge.destroy();
        this.views.delete(id);
      }
    }
  }

  private createView(s: Structure): StructureView {
    const c = tileCenter(s.x, s.y);
    const main = this.add.image(c.x, c.y, '__MISSING');
    const endcap = this.add.image(c.x, c.y, this.tex('belt.end')).setVisible(false).setDepth(DEPTH.belt + 1);
    endcap.setDisplaySize(TILE, TILE);
    const badge = this.add.image(c.x + TILE * 0.3, c.y - TILE * 0.3, this.tex('badge.blocked')).setVisible(false).setDepth(DEPTH.badge);
    badge.setDisplaySize(TILE * 0.45, TILE * 0.45);
    const v: StructureView = { id: s.id, kind: s.kind, main, endcap, badge, lastKey: '', bounceUntil: 0 };
    if (!this.store.reducedMotion()) {
      main.setScale(0.6);
      this.tweens.add({ targets: main, scaleX: 1, scaleY: 1, duration: 220, ease: 'Back.easeOut', onUpdate: () => undefined });
    }
    return v;
  }

  private feeders(s: Structure): Dir[] {
    const out: Dir[] = [];
    for (const d of [0, 1, 2, 3] as Dir[]) {
      const n = this.store.sim.at(s.x + DX[d], s.y + DY[d]);
      if (!n) continue;
      const role = STRUCTURES[n.kind].role;
      if (role === 'packing') continue;
      if (n.facing === opposite(d)) out.push(d);
    }
    return out;
  }

  private updateView(v: StructureView, s: Structure, world: World, simTime: number): void {
    const c = tileCenter(s.x, s.y);
    v.main.setPosition(c.x, c.y);
    const def = STRUCTURES[s.kind];
    const tick = world.tick;
    let badgeKey: string | null = null;

    if (s.kind === 'belt') {
      const reduced = this.store.reducedMotion();
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
        badgeKey = st.block === 'wrong_item' ? 'badge.wrong' : 'badge.blocked';
      }
    } else if (def.role === 'producer') {
      const p = s.producer!;
      const ratio = p.growTicks / def.growTicks!;
      const state: BedState = p.output ? 'ready' : ratio < 0.34 ? 'empty' : ratio < 0.7 ? 'grow0' : 'grow1';
      this.setImage(v.main, bedKey(s.kind, s.facing, state));
      v.main.setDisplaySize(TILE * 1.125, TILE * 1.125).setDepth(DEPTH.structure + s.y * 0.01);
      if (p.blocked) badgeKey = 'badge.blocked';
    } else if (def.role === 'processor') {
      const m = s.processor!;
      let state: MachineState;
      if (m.workTicks !== null) {
        const f = this.store.reducedMotion() ? 0 : Math.floor(simTime / 180) % 4;
        state = `work${f}` as MachineState;
      } else if (m.outputs.length > 0) state = 'ready';
      else state = 'idle';
      this.setImage(v.main, machineKey(s.kind, s.facing, state));
      v.main.setDisplaySize(TILE * 1.125, TILE * 1.125).setDepth(DEPTH.structure + s.y * 0.01);
      if (m.blocked) badgeKey = 'badge.blocked';
      else if (m.workTicks === null && m.inputs.length > 0) badgeKey = 'badge.waiting';
      else if (tick - m.lastRefusedTick < 15 && m.lastRefusedTick >= 0) badgeKey = 'badge.wrong';
    } else {
      const pk = s.packing!;
      const since = tick - pk.lastReceivedTick;
      let state: 'idle' | 'receive0' | 'receive1' | 'receive2' | 'receive3' = 'idle';
      if (pk.lastReceivedTick >= 0 && since < 8 && !this.store.reducedMotion()) {
        state = `receive${Math.min(3, Math.floor(since / 2))}` as typeof state;
      }
      this.setImage(v.main, packingKey(state));
      v.main.setDisplaySize(TILE * 1.125, TILE * 1.125).setDepth(DEPTH.structure + s.y * 0.01);
    }

    if (badgeKey) {
      this.setImage(v.badge, badgeKey);
      v.badge.setVisible(true).setPosition(c.x + TILE * 0.3, c.y - TILE * 0.3);
      if (!this.store.reducedMotion()) v.badge.setY(c.y - TILE * 0.3 + Math.sin(simTime / 220) * 2);
    } else {
      v.badge.setVisible(false);
    }
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
        const sprite = this.add.image(0, 0, this.tex(itemKey(item.kind))).setDepth(DEPTH.item);
        sprite.setDisplaySize(TILE * 0.5, TILE * 0.5);
        v = { sprite, kind: item.kind };
        this.items.set(item.id, v);
      }
      const t = beltProgressT(s, alpha);
      const p = itemPositionOnBelt(s, t);
      v.sprite.setPosition(p.x, p.y).setDepth(DEPTH.item + s.y * 0.01);
    }
    for (const [id, v] of this.items) {
      if (!alive.has(id)) {
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

    for (const g of this.ghostBelts) g.setVisible(false);
    const hover = ui.hover;
    this.hoverRing.setVisible(false);
    if (ui.tool.type === 'build' && hover && !ui.dragPath) {
      const check = this.store.sim.canPlace(ui.tool.kind, hover.x, hover.y);
      const c = tileCenter(hover.x, hover.y);
      this.setImage(this.ghostRing, check.ok ? 'tile.valid' : 'tile.invalid');
      this.ghostRing.setVisible(true).setPosition(c.x, c.y);
      const def = STRUCTURES[ui.tool.kind];
      const key = ui.tool.kind === 'belt' ? 'belt.straight.0' : def.role === 'producer' ? bedKey(ui.tool.kind, ui.buildFacing, 'ready') : def.role === 'processor' ? machineKey(ui.tool.kind, ui.buildFacing, 'idle') : paletteKey(ui.tool.kind);
      this.setImage(this.ghost, key, ui.tool.kind === 'belt' ? FACING_ANGLE[ui.buildFacing] : 0);
      const size = ui.tool.kind === 'belt' ? TILE : TILE * 1.125;
      this.ghost.setVisible(true).setPosition(c.x, c.y).setDisplaySize(size, size).setAlpha(check.ok ? 0.75 : 0.4);
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
      if (hover && (ui.tool.type === 'remove' || ui.tool.type === 'basket')) {
        const target = this.store.sim.at(hover.x, hover.y);
        const ok = ui.tool.type === 'remove' ? !!target : !!target && target.kind === 'belt' && !target.belt!.item;
        const c = tileCenter(hover.x, hover.y);
        this.setImage(this.hoverRing, ok ? (ui.tool.type === 'remove' ? 'tile.invalid' : 'tile.valid') : 'tile.invalid');
        this.hoverRing.setVisible(true).setPosition(c.x, c.y).setAlpha(ok ? 0.9 : 0.35);
      }
    }
  }

  // ---- effects ------------------------------------------------------------------------
  private handleEvents(events: SimEvent[], world: World): void {
    const reduced = this.store.reducedMotion();
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
              this.petals?.explode(26, c.x, c.y);
            }
          }
          this.cameras.main.flash(260, 246, 235, 213, false);
          break;
        }
        case 'all_orders_complete': {
          if (reduced) break;
          const cx = (world.width * TILE) / 2;
          this.petals?.explode(80, cx, world.height * TILE * 0.3);
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
    if (this.store.reducedMotion()) return;
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
        const inside = t.x >= 0 && t.y >= 0 && t.x < this.store.sim.world.width && t.y < this.store.sim.world.height;
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
      const inside = t.x >= 0 && t.y >= 0 && t.x < this.store.sim.world.width && t.y < this.store.sim.world.height;
      switch (ui.tool.type) {
        case 'build':
          if (ui.tool.kind === 'belt') {
            if (inside) {
              this.dragging = { mode: 'belt', ...base };
              this.store.setUi({ dragPath: [t] });
            } else this.dragging = { mode: 'maybe-pan', ...base };
          } else if (inside) {
            this.store.dispatch({ type: 'place', kind: ui.tool.kind, x: t.x, y: t.y, facing: ui.buildFacing });
          } else this.dragging = { mode: 'maybe-pan', ...base };
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
          if (target) {
            this.store.select(target.id);
            this.dragging = { mode: 'maybe-pan', ...base };
          } else {
            this.dragging = { mode: 'maybe-pan', ...base };
          }
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
        // A plain click: right-click cancels the tool, left-click on empty deselects.
        if (p.button === 2) {
          if (this.store.ui.tool.type !== 'select') this.store.setTool({ type: 'select' });
          else this.store.select(null);
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
    const w = this.store.sim.world;
    if (t.x < 0 || t.y < 0 || t.x >= w.width || t.y >= w.height) return;
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
    this.camCtl.fit();
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
