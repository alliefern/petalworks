import type { OrderDef } from '../types';

/**
 * Hand-authored order sequence. Each order unlocks the tools needed for it the moment
 * it becomes active, so nothing required is ever locked. Rewards follow BALANCE.md.
 * Customer names and notes are placeholders until the copy pass (docs/content/COPY.md).
 */
export const ORDERS: OrderDef[] = [
  {
    id: 'order1',
    customer: 'Nell',
    title: '2 Daisies',
    note: 'Two loose daisies. I keep one glass by the sink.',
    requires: { daisy: 2 },
    reward: 50,
    unlocks: ['daisy_bed', 'belt', 'bundling_table'],
    hint: 'Place a Daisy Bed, run a belt from its chute to the Packing Station, and wait for daisies to grow.',
  },
  {
    id: 'order2',
    customer: 'Otto',
    title: '2 Daisy Bundles',
    note: 'Bundle them, please. Loose stems make a mess of my satchel.',
    requires: { daisy_bundle: 2 },
    reward: 70,
    unlocks: [],
    hint: 'Route daisies into a Bundling Table. It ties two into a bundle and pushes it out of the side it faces.',
  },
  {
    id: 'order3',
    customer: 'Hester',
    title: '4 Daisy Bundles',
    note: 'Four bundles for the counter. Saturday gets busy.',
    requires: { daisy_bundle: 4 },
    reward: 100,
    unlocks: [],
    hint: 'A second Daisy Bed feeding the same table doubles your bundle output.',
  },
  {
    id: 'order4',
    customer: 'Ivo',
    title: '2 Lavender',
    note: "Leave them loose. I'll take the sprigs as they are.",
    requires: { lavender: 2 },
    reward: 80,
    unlocks: ['lavender_bed'],
    unlocksExpansion: true,
    hint: 'Lavender Beds are available now. Lavender grows a little slower than daisies.',
  },
  {
    id: 'order5',
    customer: 'Pia',
    title: '2 Lavender Sachets',
    note: 'Two sachets for the linen shelf, when you have them.',
    requires: { lavender_sachet: 2 },
    reward: 110,
    unlocks: ['drying_bench'],
    hint: 'A Drying Bench turns two lavender into a sachet. Build a second line beside your daisy line.',
  },
  {
    id: 'order6',
    customer: 'Ada',
    title: '1 Mixed Bouquet',
    note: 'One bouquet for the table. Daisies and lavender together.',
    requires: { mixed_bouquet: 1 },
    reward: 140,
    unlocks: ['arrangement_table'],
    hint: 'The Arrangement Table takes a Daisy Bundle and a Lavender Sachet from any side and sends out a bouquet.',
  },
];

export const ORDER_COUNT = ORDERS.length;

export function orderById(id: string | null): OrderDef | null {
  return id ? (ORDERS.find((o) => o.id === id) ?? null) : null;
}

export function orderIndex(id: string | null): number {
  return id ? ORDERS.findIndex((o) => o.id === id) : ORDERS.length;
}
