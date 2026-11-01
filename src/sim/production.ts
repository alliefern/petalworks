import { BLOCKED_NOTICE_TICKS, OUTPUT_BUFFER_CAP } from './data/balance';
import { RECIPES } from './data/recipes';
import { STRUCTURES } from './data/structures';
import type { TileIndex } from './grid';
import { tryPushOut } from './transport';
import type { BlockReason, Item, ItemKind, SimEvent, Structure, World } from './types';

export function newItem(world: World, kind: ItemKind): Item {
  return { id: world.nextItemId++, kind };
}

function noteBlocked(s: Structure, state: { blockedTicks: number; block: BlockReason }, reason: BlockReason, events: SimEvent[]): void {
  if (reason === 'none') {
    state.blockedTicks = 0;
    state.block = 'none';
    return;
  }
  const changed = state.block !== reason;
  state.block = reason;
  state.blockedTicks += 1;
  // Edge-trigger once a block has persisted (so a momentary queue does not chime), and again if the reason changes.
  if (state.blockedTicks === BLOCKED_NOTICE_TICKS || (changed && state.blockedTicks > BLOCKED_NOTICE_TICKS)) {
    events.push({ type: 'blocked', structureId: s.id, reason });
  }
}

export function tickProducers(world: World, index: TileIndex, events: SimEvent[]): void {
  for (const s of sortedByRole(world, 'producer')) {
    const def = STRUCTURES[s.kind];
    const p = s.producer!;
    if (!p.output) {
      p.growTicks += 1;
      if (p.growTicks >= def.growTicks!) {
        p.growTicks = 0;
        p.output = newItem(world, def.produces!);
        events.push({ type: 'item_spawned', structureId: s.id, item: p.output });
      }
    }
    if (p.output) {
      const reason = tryPushOut(world, index, s, p.output, events);
      if (reason === 'none') p.output = null;
      noteBlocked(s, p, reason, events);
    } else {
      noteBlocked(s, p, 'none', events);
    }
  }
}

export function hasInputsFor(s: Structure): boolean {
  const recipe = RECIPES[s.processor!.recipeId];
  for (const [kind, need] of Object.entries(recipe.inputs)) {
    const have = s.processor!.inputs.filter((i) => i.kind === kind).length;
    if (have < (need ?? 0)) return false;
  }
  return true;
}

export function tickProcessors(world: World, index: TileIndex, events: SimEvent[]): void {
  for (const s of sortedByRole(world, 'processor')) {
    const m = s.processor!;
    const recipe = RECIPES[m.recipeId];

    if (m.workTicks !== null) {
      m.workTicks += 1;
      if (m.workTicks >= recipe.durationTicks) {
        m.workTicks = null;
        const item = newItem(world, recipe.output);
        m.outputs.push(item);
        world.stats.crafted += 1;
        events.push({ type: 'crafted', structureId: s.id, item });
      }
    }

    if (m.workTicks === null && m.outputs.length < OUTPUT_BUFFER_CAP && hasInputsFor(s)) {
      for (const [kind, need] of Object.entries(recipe.inputs)) {
        let remaining = need ?? 0;
        m.inputs = m.inputs.filter((i) => {
          if (remaining > 0 && i.kind === kind) {
            remaining -= 1;
            return false;
          }
          return true;
        });
      }
      m.workTicks = 0;
    }

    if (m.outputs.length > 0) {
      const reason = tryPushOut(world, index, s, m.outputs[0], events);
      if (reason === 'none') m.outputs.shift();
      noteBlocked(s, m, reason, events);
    } else {
      noteBlocked(s, m, 'none', events);
    }
  }
}

function sortedByRole(world: World, role: 'producer' | 'processor'): Structure[] {
  const out: Structure[] = [];
  for (const id of Object.keys(world.structures).map(Number).sort((a, b) => a - b)) {
    const s = world.structures[id];
    if (STRUCTURES[s.kind].role === role) out.push(s);
  }
  return out;
}
