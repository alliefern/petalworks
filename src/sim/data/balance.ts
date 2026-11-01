/**
 * Balance knobs. Numbers follow docs/design/BALANCE.md; durations are integer ticks.
 * Change values here, never in logic.
 */

/** Fixed simulation rate. 10 Hz divides every duration in the brief exactly. */
export const TICK_HZ = 10;
export const TICK_MS = 1000 / TICK_HZ;

/** Convert designer seconds to ticks. Throws on a non-integer result so nothing drifts. */
export function seconds(s: number): number {
  const t = s * TICK_HZ;
  if (!Number.isInteger(t)) throw new Error(`${s}s is not a whole number of ticks at ${TICK_HZ} Hz`);
  return t;
}

/** Ticks for an item to cross one belt tile (0.5 s). */
export const BELT_TICKS = seconds(0.5);

/** Each processor ingredient slot holds this many items. */
export const INPUT_BUFFER_PER_INGREDIENT = 8;
/** Finished products a processor holds before it pauses crafting (one output slot). */
export const OUTPUT_BUFFER_CAP = 1;

/** Packing stations refuse an item kind once this many sit unallocated in stock. */
export const STOCK_CAP = 12;

export const START_COINS = 120;

/** Where the free Packing Station sits in a new garden. */
export const PACKING_START = { x: 13, y: 6 } as const;

export const UNDO_STACK_LIMIT = 30;

/** Ticks a bed or machine must be unable to output before the "blocked" edge fires (sound + notice). */
export const BLOCKED_NOTICE_TICKS = 10;
