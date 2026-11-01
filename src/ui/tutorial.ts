import { orderIndex } from '../sim/data/orders';
import type { World } from '../sim/types';

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
}

/** Contextual tips: the step is derived from what the player has built so far. */
export function tutorialStepFor(world: World): TutorialStep | null {
  const list = Object.values(world.structures);
  const has = (kind: string) => list.some((s) => s.kind === kind);
  const idx = orderIndex(world.orders.activeId);
  if (idx === 0) {
    if (!has('daisy_bed')) return { id: 'bed', title: 'Tip 1 of 4 · Plant', body: 'Nell wants 2 daisies. Pick the **Daisy Bed** from the shelf below and click open grass to plant it. Press **R** first to turn the side it grows out of.' };
    if (!has('belt')) return { id: 'belt', title: 'Tip 2 of 4 · Connect', body: 'Choose **Conveyor Belt**, then click and drag from the bed’s arrow toward the **Packing Station** (the crate on the right). Belts carry one flower per tile.' };
    if (world.stats.delivered === 0) return { id: 'watch', title: 'Tip 3 of 4 · Watch', body: 'Daisies grow every 4 seconds and ride the belt into the crate. A flower only counts when it arrives. If something stops, a badge appears: click it to read why. **P** pauses, **F** speeds things up.' };
    return { id: 'first', title: 'Tip 4 of 4 · Nearly there', body: 'One more daisy finishes the order. Each finished order pays coins and opens something new. Leave the Bundling Table out of this path until an order asks for bundles.' };
  }
  if (idx === 1 && !has('bundling_table')) {
    return { id: 'bundle', title: 'Tip · Bundling Table', body: 'Otto wants Daisy Bundles. Put a **Bundling Table** on the belt path. It takes daisies from any side, ties two into a bundle, and sends it out of the side its arrow points. Belt that on to the crate.' };
  }
  if (idx === 1) {
    return { id: 'fixups', title: 'Tip · Fix-ups', body: 'Click any bed, belt, or machine to inspect it. **Z** undoes a build, **Remove** picks things up for a refund, and right-click or **Esc** cancels a tool.' };
  }
  if (idx === 2) {
    return { id: 'more', title: 'Tip · Throughput', body: 'Hester wants 4 bundles. A second **Daisy Bed** belted into the same table doubles your bundles. Belts can join from the side.' };
  }
  if (idx === 3 && !has('lavender_bed')) {
    return { id: 'lavender', title: 'Tip · Lavender', body: 'Ivo wants raw lavender. Place a **Lavender Bed** and belt it to the crate. It grows more slowly than daisies. The **Open Plot** button adds more grass if you want room.' };
  }
  if (idx === 4 && !has('drying_bench')) {
    return { id: 'sachets', title: 'Tip · Drying Bench', body: 'Pia wants Lavender Sachets. Put a **Drying Bench** on the lavender line: lavender in from any side, sachets out of the arrow side, then on to the crate.' };
  }
  if (idx === 5 && !has('arrangement_table')) {
    return { id: 'bouquet', title: 'Tip · Arrangement Table', body: 'Ada wants 1 Mixed Bouquet. Feed an **Arrangement Table** one Daisy Bundle and one Lavender Sachet from any sides, then belt the bouquet to the crate.' };
  }
  return null;
}
