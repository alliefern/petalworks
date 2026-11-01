// Pure simulation types. No React or Phaser imports anywhere in src/sim.

/** Cardinal direction. 0 = north (up), 1 = east, 2 = south, 3 = west. */
export type Dir = 0 | 1 | 2 | 3;

export type ItemKind =
  | 'daisy'
  | 'lavender'
  | 'daisy_bundle'
  | 'lavender_sachet'
  | 'mixed_bouquet';

export type StructureKind =
  | 'belt'
  | 'daisy_bed'
  | 'lavender_bed'
  | 'bundling_table'
  | 'drying_bench'
  | 'arrangement_table'
  | 'packing_station';

/** Items are discrete: a stable id and a definition id (`kind`). */
export interface Item {
  id: number;
  kind: ItemKind;
}

/** Why an item on a belt cannot move forward right now. */
export type BlockReason =
  | 'none'
  | 'queue' // next belt is simply occupied; normal
  | 'dead_end' // nothing in front, or something with no input on that side
  | 'head_on' // belt in front points back at us
  | 'wrong_item' // machine in front has no recipe for this item
  | 'buffer_full' // machine in front cannot take more of this item
  | 'stock_full'; // packing station has too many of this already

export interface BeltState {
  item: Item | null;
  /** 0..BELT_TICKS. Item is at the tile's exit edge when progress >= BELT_TICKS. */
  progress: number;
  /** Side the item entered from (direction pointing from tile centre toward the source). */
  from: Dir;
  block: BlockReason;
  /** Consecutive ticks the item has been unable to leave. */
  stuckTicks: number;
}

export interface ProducerState {
  /** Growth ticks accumulated toward the next flower. */
  growTicks: number;
  /** A grown flower waiting to be pushed out. */
  output: Item | null;
  /** Consecutive ticks the output has been unable to leave (0 = not blocked). */
  blockedTicks: number;
  /** Why the output cannot leave, when blockedTicks > 0. */
  block: BlockReason;
}

export interface ProcessorState {
  /** Recipe this machine is set to. Slice machines have exactly one. */
  recipeId: string;
  /** Typed per-ingredient buffers; capped per ingredient so one input can never starve another. */
  inputs: Item[];
  /** Finished product waiting for the output side to free up (capacity OUTPUT_BUFFER_CAP). */
  outputs: Item[];
  /** Ticks of work done on the current craft; null when not crafting. */
  workTicks: number | null;
  blockedTicks: number;
  block: BlockReason;
  /** Tick at which an item was last refused (for feedback). */
  lastRefusedTick: number;
  lastRefusedKind: ItemKind | null;
}

export interface PackingState {
  /** Tick at which an item was last received (for the receive animation). */
  lastReceivedTick: number;
  received: number;
}

/** A placed thing. `id` is the stable uid, `kind` the definition id. */
export interface Structure {
  id: number;
  kind: StructureKind;
  x: number;
  y: number;
  facing: Dir;
  belt?: BeltState;
  producer?: ProducerState;
  processor?: ProcessorState;
  packing?: PackingState;
}

export type Counts = Partial<Record<ItemKind, number>>;

/** The order board. The slice pins one slip at a time, but the shape allows more. */
export interface OrderBoard {
  /** Active order id, or null once every order is done (sandbox / open market). */
  activeId: string | null;
  offeredIds: string[];
  completedIds: string[];
  progress: { orderId: string | null; delivered: Counts };
}

export interface World {
  tick: number;
  /** Bounding box of the open plots. Origin (0,0) is the northwest corner and never moves. */
  cols: number;
  rows: number;
  unlockedPlotIds: string[];
  structures: Record<number, Structure>;
  nextStructureId: number;
  nextItemId: number;
  coins: number;
  /** Goods delivered to packing stations and not yet allocated to an order. */
  stock: Counts;
  /** Items recovered from removed structures. Player can drop them back on a belt. */
  basket: Counts;
  orders: OrderBoard;
  /** Unlocked structure definition ids. */
  unlocked: string[];
  expansionUnlocked: boolean;
  /** Lifetime stats for the completion screen. */
  stats: { delivered: number; crafted: number; coinsEarned: number };
}

export interface Recipe {
  id: string;
  inputs: Counts;
  output: ItemKind;
  /** Integer ticks at TICK_HZ. */
  durationTicks: number;
}

export type StructureRole = 'belt' | 'producer' | 'processor' | 'packing';

/** Ports are facing-relative so a rotated machine keeps its behaviour. */
export interface Port {
  dir: 'facing' | 'left' | 'right' | 'back' | 'all';
  role: 'in' | 'out';
}

export interface StructureDef {
  kind: StructureKind;
  name: string;
  /** One-line purpose shown in tooltips. */
  blurb: string;
  cost: number;
  /** Coins returned on removal. */
  refund: number;
  role: StructureRole;
  ports: Port[];
  /** Producer: what grows and how long (ticks). */
  produces?: ItemKind;
  growTicks?: number;
  /** Processor: recipes this machine can run (slice machines have one). */
  recipeIds?: string[];
  /** Does the facing matter for this structure? */
  hasFacing: boolean;
  /** Can the player build it from the palette? */
  buildable: boolean;
  /** Can the player remove it? */
  removable: boolean;
}

export interface ItemDef {
  kind: ItemKind;
  name: string;
  plural: string;
  /** Coins paid per unit in sandbox mode. */
  value: number;
}

export interface OrderDef {
  id: string;
  customer: string;
  title: string;
  /** Short note from the customer, shown in the order panel. */
  note: string;
  requires: Counts;
  reward: number;
  /** Structures that become available when this order becomes active. */
  unlocks: StructureKind[];
  /** Whether the garden expansion becomes purchasable when this order starts. */
  unlocksExpansion?: boolean;
  /** Hint shown to the player while the order is active. */
  hint: string;
}

export interface PlotDef {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  cost: number;
}

// ---- Actions -------------------------------------------------------------

export type Action =
  | { type: 'place'; kind: StructureKind; x: number; y: number; facing: Dir }
  | { type: 'place_belt_path'; tiles: Array<{ x: number; y: number; facing?: Dir }> }
  | { type: 'rotate'; id: number; facing?: Dir }
  | { type: 'remove'; id: number }
  | { type: 'undo' }
  | { type: 'basket_drop'; kind: ItemKind; x: number; y: number }
  | { type: 'expand' };

export type ActionError =
  | 'locked'
  | 'unaffordable'
  | 'occupied'
  | 'out_of_bounds'
  | 'locked_plot'
  | 'unknown_structure'
  | 'not_buildable'
  | 'not_removable'
  | 'nothing_to_undo'
  | 'undo_unsafe'
  | 'not_a_belt'
  | 'belt_occupied'
  | 'basket_empty'
  | 'expansion_locked'
  | 'already_expanded'
  | 'invalid';

export interface ActionResult {
  ok: boolean;
  error?: ActionError;
  /** Human readable message suitable for a notification. */
  message?: string;
  /** Ids touched, for selection/feedback. */
  ids?: number[];
  /** Coins returned by this action (removal). */
  refund?: number;
}

// ---- Events --------------------------------------------------------------

export type SimEvent =
  | { type: 'item_spawned'; structureId: number; item: Item }
  | { type: 'item_moved'; item: Item; fromId: number; toId: number }
  | { type: 'crafted'; structureId: number; item: Item }
  | { type: 'delivered'; structureId: number; item: Item; sold?: number }
  | { type: 'refused'; structureId: number; fromId: number; kind: ItemKind; reason: BlockReason }
  | { type: 'blocked'; structureId: number; reason: BlockReason }
  | { type: 'order_progress'; orderId: string }
  | { type: 'order_complete'; orderId: string; reward: number; final: boolean }
  | { type: 'unlocked'; kinds: StructureKind[]; expansion: boolean }
  | { type: 'all_orders_complete' }
  | { type: 'placed'; structureId: number; kind: StructureKind }
  | { type: 'removed'; structureId: number; kind: StructureKind; recovered: Counts; refund: number }
  | { type: 'rotated'; structureId: number }
  | { type: 'expanded' };
