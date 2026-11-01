import type { Port, StructureDef, StructureKind } from '../types';
import { seconds } from './balance';

const BED_PORTS: Port[] = [{ dir: 'facing', role: 'out' }];
const PROCESSOR_PORTS: Port[] = [
  { dir: 'all', role: 'in' },
  { dir: 'facing', role: 'out' },
];
const BELT_PORTS: Port[] = [
  { dir: 'back', role: 'in' },
  { dir: 'left', role: 'in' },
  { dir: 'right', role: 'in' },
  { dir: 'facing', role: 'out' },
];
const PACKING_PORTS: Port[] = [{ dir: 'all', role: 'in' }];

/** Costs and refunds follow docs/design/BALANCE.md (belts refund fully, buildings 75%). */
export const STRUCTURES: Record<StructureKind, StructureDef> = {
  belt: {
    kind: 'belt',
    name: 'Conveyor Belt',
    blurb: 'Carries one item per tile, only in the direction it faces.',
    cost: 2,
    refund: 2,
    role: 'belt',
    ports: BELT_PORTS,
    hasFacing: true,
    buildable: true,
    removable: true,
  },
  daisy_bed: {
    kind: 'daisy_bed',
    name: 'Daisy Bed',
    blurb: 'Grows one daisy at a time, out of the side you aim.',
    cost: 20,
    refund: 15,
    role: 'producer',
    ports: BED_PORTS,
    produces: 'daisy',
    growTicks: seconds(4),
    hasFacing: true,
    buildable: true,
    removable: true,
  },
  lavender_bed: {
    kind: 'lavender_bed',
    name: 'Lavender Bed',
    blurb: 'Grows one sprig at a time, out of the side you aim. Slower than daisies.',
    cost: 40,
    refund: 30,
    role: 'producer',
    ports: BED_PORTS,
    produces: 'lavender',
    growTicks: seconds(6),
    hasFacing: true,
    buildable: true,
    removable: true,
  },
  bundling_table: {
    kind: 'bundling_table',
    name: 'Bundling Table',
    blurb: 'Ties 2 daisies into one Daisy Bundle.',
    cost: 40,
    refund: 30,
    role: 'processor',
    ports: PROCESSOR_PORTS,
    recipeIds: ['daisy_bundle'],
    hasFacing: true,
    buildable: true,
    removable: true,
  },
  drying_bench: {
    kind: 'drying_bench',
    name: 'Drying Bench',
    blurb: 'Dries 2 lavender into one Lavender Sachet.',
    cost: 60,
    refund: 45,
    role: 'processor',
    ports: PROCESSOR_PORTS,
    recipeIds: ['lavender_sachet'],
    hasFacing: true,
    buildable: true,
    removable: true,
  },
  arrangement_table: {
    kind: 'arrangement_table',
    name: 'Arrangement Table',
    blurb: 'Makes a Mixed Bouquet from one bundle and one sachet.',
    cost: 80,
    refund: 60,
    role: 'processor',
    ports: PROCESSOR_PORTS,
    recipeIds: ['mixed_bouquet'],
    hasFacing: true,
    buildable: true,
    removable: true,
  },
  packing_station: {
    kind: 'packing_station',
    name: 'Packing Station',
    blurb: 'Takes deliveries from any side and counts them toward the open order.',
    cost: 0,
    refund: 0,
    role: 'packing',
    ports: PACKING_PORTS,
    hasFacing: false,
    buildable: false,
    removable: false,
  },
};

export const STRUCTURE_KINDS = Object.keys(STRUCTURES) as StructureKind[];

/** Order in which the build palette lists things. */
export const PALETTE_ORDER: StructureKind[] = [
  'daisy_bed',
  'lavender_bed',
  'belt',
  'bundling_table',
  'drying_bench',
  'arrangement_table',
];

export function isStructureKind(v: unknown): v is StructureKind {
  return typeof v === 'string' && v in STRUCTURES;
}
