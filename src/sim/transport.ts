import { BELT_TICKS, INPUT_BUFFER_MULTIPLIER, STOCK_CAP } from './data/balance';
import { ITEMS } from './data/items';
import { RECIPES } from './data/recipes';
import { STRUCTURES } from './data/structures';
import { DX, DY, opposite, structureAt, TileIndex } from './grid';
import { currentOrder, isSandbox } from './orders';
import type { BlockReason, Dir, Item, ItemKind, SimEvent, Structure, World } from './types';

/** Why a destination would refuse `kind` arriving from side `fromDir` (direction from dest toward source). */
export function refusalReason(world: World, dest: Structure | null, kind: ItemKind, fromDir: Dir): BlockReason {
  if (!dest) return 'dead_end';
  switch (STRUCTURES[dest.kind].role) {
    case 'belt': {
      if (dest.facing === fromDir) return 'head_on';
      return dest.belt!.item ? 'queue' : 'none';
    }
    case 'producer':
      return 'dead_end';
    case 'processor': {
      const recipe = RECIPES[STRUCTURES[dest.kind].recipe!];
      const need = recipe.inputs[kind];
      if (!need) return 'wrong_item';
      const have = dest.processor!.inputs.filter((i) => i.kind === kind).length;
      return have >= need * INPUT_BUFFER_MULTIPLIER ? 'buffer_full' : 'none';
    }
    case 'packing': {
      if (isSandbox(world)) return 'none';
      const order = currentOrder(world);
      const needed = order?.requires[kind] ?? 0;
      const progress = world.orderProgress[kind] ?? 0;
      if (needed > progress) return 'none';
      return (world.stock[kind] ?? 0) >= STOCK_CAP ? 'stock_full' : 'none';
    }
  }
}

/**
 * Hand `item` to `dest`, which must have been checked with refusalReason === 'none'.
 * Returns events produced (delivery, allocation). Caller removes the item from its source.
 */
export function acceptItem(world: World, dest: Structure, item: Item, fromDir: Dir, events: SimEvent[]): void {
  switch (STRUCTURES[dest.kind].role) {
    case 'belt':
      dest.belt!.item = item;
      dest.belt!.progress = 0;
      dest.belt!.from = fromDir;
      dest.belt!.block = 'none';
      dest.belt!.stuckTicks = 0;
      return;
    case 'processor':
      dest.processor!.inputs.push(item);
      return;
    case 'packing': {
      dest.packing!.lastReceivedTick = world.tick;
      dest.packing!.received += 1;
      world.stats.delivered += 1;
      if (isSandbox(world)) {
        // Open market: finished goods sell as they arrive.
        const value = ITEM_VALUE[item.kind];
        world.coins += value;
        world.stats.coinsEarned += value;
        events.push({ type: 'delivered', structureId: dest.id, item, sold: value });
      } else {
        world.stock[item.kind] = (world.stock[item.kind] ?? 0) + 1;
        events.push({ type: 'delivered', structureId: dest.id, item });
      }
      return;
    }
    case 'producer':
      throw new Error('producers never accept items');
  }
}

const ITEM_VALUE: Record<ItemKind, number> = Object.fromEntries(
  Object.values(ITEMS).map((d) => [d.kind, d.value]),
) as Record<ItemKind, number>;

/** Try to push an item out of a structure in its facing direction. */
export function tryPushOut(
  world: World,
  index: TileIndex,
  source: Structure,
  item: Item,
  events: SimEvent[],
): BlockReason {
  const tx = source.x + DX[source.facing];
  const ty = source.y + DY[source.facing];
  const dest = structureAt(world, index, tx, ty);
  const fromDir = opposite(source.facing);
  const reason = refusalReason(world, dest, item.kind, fromDir);
  if (reason !== 'none') return reason;
  acceptItem(world, dest!, item, fromDir, events);
  events.push({ type: 'item_moved', item, fromId: source.id, toId: dest!.id });
  return 'none';
}

/** Priority of a source feeding belt `dest` from `fromDir`: behind first, then right, then left. */
function feedPriority(dest: Structure, fromDir: Dir): number {
  if (fromDir === opposite(dest.facing)) return 0;
  if (fromDir === ((dest.facing + 1) % 4)) return 1;
  return 2;
}

/**
 * Advance belt items and resolve transfers. Deterministic: belts are visited in id order,
 * contested destinations pick the highest-priority feeder, and we repeat passes so a
 * tightly packed line flows forward as a unit instead of leaving gaps.
 */
export function tickBelts(world: World, index: TileIndex, events: SimEvent[]): void {
  const belts: Structure[] = [];
  for (const id of Object.keys(world.structures).map(Number).sort((a, b) => a - b)) {
    const s = world.structures[id];
    if (s.kind === 'belt') belts.push(s);
  }

  // 1. Advance.
  for (const b of belts) {
    const st = b.belt!;
    if (st.item && st.progress < BELT_TICKS) st.progress += 1;
  }

  // 2. Transfer, in passes.
  const movedThisTick = new Set<number>();
  // Final reason for belts whose item could not leave this tick (dest id for feedback).
  const stuck = new Map<number, { reason: BlockReason; destId: number }>();
  for (let pass = 0; pass < 6; pass++) {
    type Candidate = { source: Structure; dest: Structure | null; fromDir: Dir; priority: number };
    const byDest = new Map<number, Candidate[]>();
    stuck.clear();
    for (const b of belts) {
      const st = b.belt!;
      if (!st.item || st.progress < BELT_TICKS || movedThisTick.has(st.item.id)) continue;
      const dest = structureAt(world, index, b.x + DX[b.facing], b.y + DY[b.facing]);
      const fromDir = opposite(b.facing);
      if (!dest) {
        stuck.set(b.id, { reason: 'dead_end', destId: b.id });
        continue;
      }
      const cand: Candidate = {
        source: b,
        dest,
        fromDir,
        priority: dest.kind === 'belt' ? feedPriority(dest, fromDir) : fromDir,
      };
      const list = byDest.get(dest.id) ?? [];
      list.push(cand);
      byDest.set(dest.id, list);
    }
    let moved = false;
    for (const destId of [...byDest.keys()].sort((a, b) => a - b)) {
      const list = byDest.get(destId)!;
      list.sort((a, b) => a.priority - b.priority || a.source.id - b.source.id);
      for (const c of list) {
        const st = c.source.belt!;
        const item = st.item!;
        const reason = refusalReason(world, c.dest, item.kind, c.fromDir);
        if (reason === 'none') {
          st.item = null;
          st.progress = 0;
          st.block = 'none';
          st.stuckTicks = 0;
          acceptItem(world, c.dest!, item, c.fromDir, events);
          movedThisTick.add(item.id);
          events.push({ type: 'item_moved', item, fromId: c.source.id, toId: c.dest!.id });
          moved = true;
        } else {
          stuck.set(c.source.id, { reason, destId: c.dest!.id });
        }
      }
    }
    if (!moved) break;
  }
  for (const [beltId, info] of stuck) {
    markStuck(world.structures[beltId], info.reason, events, info.destId);
  }
}

function markStuck(belt: Structure, reason: BlockReason, events: SimEvent[], destId: number): void {
  const st = belt.belt!;
  st.block = reason;
  st.stuckTicks += 1;
  if (st.stuckTicks === 1 && reason !== 'queue' && reason !== 'none') {
    events.push({ type: 'refused', structureId: destId, fromId: belt.id, kind: st.item!.kind, reason });
  }
}
