/** Fixed simulation tick length in milliseconds. Rendering interpolates between ticks. */
export const TICK_MS = 100;
export const TICKS_PER_SECOND = 1000 / TICK_MS;

/** Ticks for an item to cross one belt tile (0.5 s). */
export const BELT_TICKS = 5;

/** A processor buffers up to recipe amount × this per ingredient. */
export const INPUT_BUFFER_MULTIPLIER = 2;
/** Finished products a processor will hold before it pauses crafting. */
export const OUTPUT_BUFFER_CAP = 2;

/** Packing stations refuse an item kind once this many sit unallocated in stock. */
export const STOCK_CAP = 12;

export const START_COINS = 60;
export const EXPANSION_COST = 40;

export const BASE_GRID = { width: 16, height: 12 };
export const EXPANDED_GRID = { width: 20, height: 14 };

/** Refund fraction when a structure is removed. 1 = full refund (no softlocks by design). */
export const REFUND_RATE = 1;

export const UNDO_STACK_LIMIT = 30;

export const seconds = (s: number): number => Math.round(s * TICKS_PER_SECOND);
