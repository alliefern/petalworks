import type { World } from '../sim/types';

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
}

/** Contextual tutorial: the step is derived from what the player has built so far. */
export function tutorialStepFor(world: World): TutorialStep | null {
  const list = Object.values(world.structures);
  const has = (kind: string) => list.some((s) => s.kind === kind);
  if (world.orderIndex === 0) {
    if (!has('daisy_bed')) return { id: 'bed', title: 'Step 1 · Plant', body: 'Pick the **Daisy Bed** from the shelf below and click a lawn tile to plant it. Press **R** before placing to turn its chute.' };
    if (!has('belt')) return { id: 'belt', title: 'Step 2 · Connect', body: 'Choose **Conveyor Belt**, then click and drag from the bed’s chute to lay a path. Belts carry one flower per tile.' };
    if (!has('packing_station')) return { id: 'pack', title: 'Step 3 · Ship', body: 'Place a **Packing Station** at the end of the belt. It accepts goods from any side and fills the order on the right.' };
    if (world.stats.delivered === 0) return { id: 'watch', title: 'Step 4 · Watch', body: 'Daisies grow every 4 seconds and ride the belt. If something stops, a badge appears: click it to see why. **Space** pauses, **2** and **3** speed things up.' };
    return { id: 'first', title: 'Nearly there', body: 'One more daisy and the first order is done. Each finished order pays coins and unlocks something new.' };
  }
  if (world.orderIndex === 1 && !has('bundling_table')) {
    return { id: 'bundle', title: 'New tool · Bundling Table', body: 'Route daisies **into** a Bundling Table. It ties two into a bundle and pushes it out of its tray side (press **R** to turn it). Send bundles on to the Packing Station.' };
  }
  if (world.orderIndex === 1) {
    return { id: 'bundle2', title: 'Tip · Fix-ups', body: 'Click any machine to inspect it. **Z** undoes a build, the trowel removes things for a full refund, and right-click cancels a tool.' };
  }
  if (world.orderIndex === 3 && !has('lavender_bed')) {
    return { id: 'lavender', title: 'New tool · Lavender Bed', body: 'Lavender grows a little slower. Give it its own belt line, or merge it into an existing one from the side.' };
  }
  if (world.orderIndex === 5 && !has('arrangement_table')) {
    return { id: 'bouquet', title: 'New tool · Arrangement Table', body: 'Feed it a Daisy Bundle **and** a Lavender Sachet from any sides. The bouquet comes out of the tray side.' };
  }
  return null;
}
