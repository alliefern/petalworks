import type { OrderDef } from '../types';

/**
 * Hand-authored order sequence. Each order unlocks the tools needed for it
 * the moment it becomes active, so nothing required is ever locked.
 */
export const ORDERS: OrderDef[] = [
  {
    id: 'o1_daisies',
    customer: 'Mrs. Alder next door',
    title: 'Two fresh daisies',
    note: 'Just a couple of daisies for the kitchen table, dear.',
    requires: { daisy: 2 },
    reward: 30,
    unlocks: ['belt', 'daisy_bed', 'packing_station'],
    hint: 'Place a Daisy Bed, run a belt from its chute to a Packing Station, and wait for daisies to grow.',
  },
  {
    id: 'o2_bundles',
    customer: 'The corner cafe',
    title: 'Two daisy bundles',
    note: 'Little bundles for the tables, tied with twine please.',
    requires: { daisy_bundle: 2 },
    reward: 45,
    unlocks: ['bundling_table'],
    hint: 'Route daisies into a Bundling Table. It ties two daisies into a bundle and pushes it out its tray side.',
  },
  {
    id: 'o3_more_bundles',
    customer: 'Spring fair committee',
    title: 'Four daisy bundles',
    note: 'The fair is Saturday. We need bundles for every stall!',
    requires: { daisy_bundle: 4 },
    reward: 80,
    unlocks: [],
    hint: 'A second Daisy Bed feeding the same table doubles your bundle output.',
  },
  {
    id: 'o4_lavender',
    customer: 'Grandpa Jun',
    title: 'Two lavender sprigs',
    note: 'For under the pillow. Helps me sleep.',
    requires: { lavender: 2 },
    reward: 60,
    unlocks: ['lavender_bed'],
    unlocksExpansion: true,
    hint: 'Lavender Beds are now available. Lavender grows a little slower than daisies.',
  },
  {
    id: 'o5_sachets',
    customer: 'The linen shop',
    title: 'Two lavender sachets',
    note: 'Dried and bagged, for the drawers.',
    requires: { lavender_sachet: 2 },
    reward: 100,
    unlocks: ['drying_bench'],
    hint: 'A Drying Bench turns two lavender into a sachet. Build a second chain beside your daisy line.',
  },
  {
    id: 'o6_bouquet',
    customer: 'A wedding in the meadow',
    title: 'One mixed bouquet',
    note: 'Daisies and lavender together. Make it lovely.',
    requires: { mixed_bouquet: 1 },
    reward: 160,
    unlocks: ['arrangement_table'],
    hint: 'The Arrangement Table takes a Daisy Bundle and a Lavender Sachet from any side and outputs a bouquet.',
  },
];

export const ORDER_COUNT = ORDERS.length;
