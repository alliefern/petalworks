import { orderIndex } from '../sim/data/orders';
import type { World } from '../sim/types';
import { COPY } from './strings';

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
}

const opening = COPY.tutorial.opening;
const byId = (id: string) => opening.find((o) => o.id === id)?.prompt ?? '';
/** Opening tips shown in this build (place-packing is skipped: the station is pre-placed). */
const OPENING_IDS = ['see-order', 'place-bed', 'lay-belt', 'turn-belt', 'watch-flow', 'fill-order', 'fix-mistakes'];

function openingStep(id: string): TutorialStep {
  const n = OPENING_IDS.indexOf(id) + 1;
  return { id, title: COPY.tutorial.step.replace('{current}', String(n)).replace('{total}', String(OPENING_IDS.length)), body: byId(id) };
}

/** Contextual tips: the step is derived from what the player has built so far. */
export function tutorialStepFor(world: World, seenOrder: boolean): TutorialStep | null {
  const list = Object.values(world.structures);
  const has = (kind: string) => list.some((s) => s.kind === kind);
  const idx = orderIndex(world.orders.activeId);
  if (idx === 0) {
    if (!seenOrder && !has('daisy_bed')) return openingStep('see-order');
    if (!has('daisy_bed')) return openingStep('place-bed');
    if (!has('belt')) return openingStep('lay-belt');
    const bedBlocked = list.some((s) => s.kind === 'daisy_bed' && (s.producer?.blockedTicks ?? 0) > 3);
    const beltStuck = list.some((s) => s.kind === 'belt' && s.belt?.item && s.belt.block !== 'none' && s.belt.block !== 'queue');
    if (world.stats.delivered === 0 && (bedBlocked || beltStuck)) return openingStep('turn-belt');
    if (world.stats.delivered === 0) return openingStep('watch-flow');
    return openingStep('fill-order');
  }
  const c = COPY.tutorial.contextual;
  if (idx === 1 && !has('bundling_table') && world.stats.crafted === 0 && list.filter((s) => s.kind === 'belt').length < 4) {
    return { id: 'fix-mistakes', title: COPY.tutorial.step.replace('{current}', '7').replace('{total}', '7'), body: byId('fix-mistakes') };
  }
  if (idx === 1 && !has('bundling_table')) return { id: 'bundles', title: COPY.howTo.laterTitle, body: c.bundles.prompt };
  if (idx === 2 && list.filter((s) => s.kind === 'daisy_bed').length < 2) return { id: 'more-bundles', title: COPY.howTo.laterTitle, body: c['more-bundles'].prompt };
  if (idx === 3 && !has('lavender_bed')) return { id: 'lavender', title: COPY.howTo.laterTitle, body: c.lavender.prompt };
  if (idx === 4 && !has('drying_bench')) return { id: 'sachets', title: COPY.howTo.laterTitle, body: c.sachets.prompt };
  if (idx === 5 && !has('arrangement_table')) return { id: 'bouquet', title: COPY.howTo.laterTitle, body: c.bouquet.prompt };
  return null;
}
