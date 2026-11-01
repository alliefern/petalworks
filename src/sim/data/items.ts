import type { ItemDef, ItemKind } from '../types';

export const ITEMS: Record<ItemKind, ItemDef> = {
  daisy: { kind: 'daisy', name: 'Daisy', value: 2 },
  lavender: { kind: 'lavender', name: 'Lavender', value: 3 },
  daisy_bundle: { kind: 'daisy_bundle', name: 'Daisy Bundle', value: 8 },
  lavender_sachet: { kind: 'lavender_sachet', name: 'Lavender Sachet', value: 12 },
  mixed_bouquet: { kind: 'mixed_bouquet', name: 'Mixed Bouquet', value: 30 },
};

export const ITEM_KINDS = Object.keys(ITEMS) as ItemKind[];

export function isItemKind(v: unknown): v is ItemKind {
  return typeof v === 'string' && v in ITEMS;
}
