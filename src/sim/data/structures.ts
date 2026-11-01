import type { StructureDef, StructureKind } from '../types';
import { seconds } from './balance';

export const STRUCTURES: Record<StructureKind, StructureDef> = {
  belt: {
    kind: 'belt',
    name: 'Conveyor Belt',
    blurb: 'Carries one item per tile in the direction of its arrows.',
    cost: 2,
    role: 'belt',
    hasFacing: true,
  },
  daisy_bed: {
    kind: 'daisy_bed',
    name: 'Daisy Bed',
    blurb: 'Grows a daisy every 4 seconds and sends it out the chute side.',
    cost: 20,
    role: 'producer',
    produces: 'daisy',
    growTicks: seconds(4),
    hasFacing: true,
  },
  lavender_bed: {
    kind: 'lavender_bed',
    name: 'Lavender Bed',
    blurb: 'Grows a lavender sprig every 6 seconds.',
    cost: 30,
    role: 'producer',
    produces: 'lavender',
    growTicks: seconds(6),
    hasFacing: true,
  },
  bundling_table: {
    kind: 'bundling_table',
    name: 'Bundling Table',
    blurb: 'Ties 2 daisies into a Daisy Bundle in 5 seconds.',
    cost: 30,
    role: 'processor',
    recipe: 'daisy_bundle',
    hasFacing: true,
  },
  drying_bench: {
    kind: 'drying_bench',
    name: 'Drying Bench',
    blurb: 'Dries 2 lavender into a Lavender Sachet in 7 seconds.',
    cost: 40,
    role: 'processor',
    recipe: 'lavender_sachet',
    hasFacing: true,
  },
  arrangement_table: {
    kind: 'arrangement_table',
    name: 'Arrangement Table',
    blurb: 'Combines a Daisy Bundle and a Lavender Sachet into a Mixed Bouquet in 8 seconds.',
    cost: 60,
    role: 'processor',
    recipe: 'mixed_bouquet',
    hasFacing: true,
  },
  packing_station: {
    kind: 'packing_station',
    name: 'Packing Station',
    blurb: 'Accepts finished goods from any side and fills the current order.',
    cost: 15,
    role: 'packing',
    hasFacing: false,
  },
};

export const STRUCTURE_KINDS = Object.keys(STRUCTURES) as StructureKind[];

/** Order in which the build palette lists things. */
export const PALETTE_ORDER: StructureKind[] = [
  'belt',
  'daisy_bed',
  'lavender_bed',
  'bundling_table',
  'drying_bench',
  'arrangement_table',
  'packing_station',
];

export function isStructureKind(v: unknown): v is StructureKind {
  return typeof v === 'string' && v in STRUCTURES;
}
