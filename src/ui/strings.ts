/**
 * Player-facing text from docs/content/copy.json (final, owned by the producer).
 * Leftover UI strings are copy.json `extra`. EXTRA_FALLBACK is used only when a key
 * is missing, and that miss is reported with a console warning.
 * American English, normal capitalization.
 */
import copy from '../../docs/content/copy.json';
import type { BlockReason, Dir, ItemKind, StructureKind } from '../sim/types';

export const COPY = copy;

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));
}

/** copy.json uses camelCase ids; the sim uses snake_case definition ids. */
const BUILDING_KEY: Record<StructureKind, keyof typeof copy.palette.buildings> = {
  daisy_bed: 'daisyBed',
  lavender_bed: 'lavenderBed',
  belt: 'belt',
  bundling_table: 'bundlingTable',
  drying_bench: 'dryingBench',
  arrangement_table: 'arrangementTable',
  packing_station: 'packingStation',
};
const ITEM_KEY: Record<ItemKind, keyof typeof copy.items> = {
  daisy: 'daisy',
  lavender: 'lavender',
  daisy_bundle: 'daisyBundle',
  lavender_sachet: 'lavenderSachet',
  mixed_bouquet: 'mixedBouquet',
};
const DIR_KEY: Record<Dir, keyof typeof copy.facing> = { 0: 'n', 1: 'e', 2: 's', 3: 'w' };

export const building = (kind: StructureKind) => copy.palette.buildings[BUILDING_KEY[kind]];
export const buildingName = (kind: StructureKind): string => building(kind).name;
export const itemName = (kind: ItemKind, n = 1): string => (n === 1 ? copy.items[ITEM_KEY[kind]].one : copy.items[ITEM_KEY[kind]].other);
export const facingWord = (d: Dir): string => copy.facing[DIR_KEY[d]];
export const recipeCopy = (id: string) => (copy.recipes as Record<string, { line: string; in?: string; out: string; time: string }>)[toCamel(id)];
export const orderCopy = (id: string) => (copy.orders as unknown as Record<string, OrderCopy>)[id];

export interface OrderCopy {
  customer: string;
  note: string;
  itemId: string;
  count: number;
  requirement: string;
  short: string;
  reward: string;
  complete: string;
  unlocks: string[];
  unlockLine: string | null;
}

function toCamel(id: string): string {
  return id.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Label + detail for a block reason, in copy.json's words. */
export function blockCopy(reason: BlockReason, opts: { item?: ItemKind | null; target?: string; onBelt?: boolean }): { label: string; detail: string } {
  const b = copy.states.blocked;
  const item = opts.item ? itemName(opts.item) : '';
  switch (reason) {
    case 'queue':
      return { label: b.exitFull.label, detail: b.exitFull.detail };
    case 'dead_end':
      return opts.onBelt ? { label: b.beltEnd.label, detail: b.beltEnd.detail } : { label: b.noExit.label, detail: b.noExit.detail };
    case 'head_on':
      return { label: b.beltEnd.label, detail: EXTRA.blocked.headOn };
    case 'wrong_item':
      return opts.onBelt
        ? { label: fmt(b.refused.label, { item }), detail: fmt(b.refused.detail, { target: opts.target ?? '', item }) }
        : { label: fmt(b.wrongItem.label, { item }), detail: fmt(b.wrongItem.detail, { machine: opts.target ?? '', item }) };
    case 'buffer_full':
      return { label: b.inputFull.label, detail: b.inputFull.detail };
    case 'stock_full':
      return { label: EXTRA.blocked.stockFull, detail: fmt(EXTRA.blocked.stockFullDetail, { item: opts.item ? itemName(opts.item, 2) : '' }) };
    default:
      return { label: '', detail: '' };
  }
}

/**
 * Fill `fallback` from copy.json. A missing key keeps the built-in string and warns,
 * so a dropped key shows up in the console and in src/ui/strings.test.ts.
 */
export function mergeExtra<T>(fallback: T, source: unknown, path = 'extra'): T {
  if (typeof fallback === 'string') {
    if (typeof source === 'string') return source as T;
    console.warn(`copy.json extra is missing "${path}". Using the built-in fallback.`);
    return fallback;
  }
  if (Array.isArray(fallback)) {
    if (!Array.isArray(source)) {
      console.warn(`copy.json extra is missing "${path}". Using the built-in fallback.`);
      return fallback;
    }
    return fallback.map((item, index) => mergeExtra(item, source[index], `${path}[${index}]`)) as T;
  }
  if (fallback !== null && typeof fallback === 'object') {
    if (source === null || typeof source !== 'object' || Array.isArray(source)) {
      console.warn(`copy.json extra is missing "${path}". Using the built-in fallback.`);
      return fallback;
    }
    const record = source as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(fallback)) {
      out[key] = mergeExtra((fallback as Record<string, unknown>)[key], record[key], `${path}.${key}`);
    }
    return out as T;
  }
  return fallback;
}

/** Built-in leftovers, used only when copy.json `extra` lacks that key. */
export const EXTRA_FALLBACK = {
  title: {
    loadingGarden: 'Loading the garden',
  },
  settings: {
    paused: 'The garden is paused while this is open.',
    soundHelp: 'Taps, pops, and chimes.',
    musicHelp: 'A quiet music-box loop.',
    tutorial: 'Tips',
    tutorialHelp: 'Show the tips again from the start.',
    newGame: 'Start over',
    newGameHelp: 'Clears this garden and starts a fresh one. This cannot be undone.',
    newGameButton: 'New game…',
    keep: 'Keep',
    backToGarden: 'Back to the garden',
  },
  hud: {
    orders: 'Orders',
    speed: 'Speed',
    speedN: '{n}×',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit',
    fitTooltip: 'Fit the garden on screen (Home).',
    tips: 'Tips',
    tipsTooltip: 'Show the tips card (H).',
    orderOf: 'Order {n} of {total}',
    forCustomer: 'for {customer}',
    sandboxBody: 'Everything you deliver now sells for coins, and every building is yours to place.',
    ordersDone: '{done} of {total} orders done',
  },
  a11y: {
    gameHelp: 'Arrow keys move the cursor. Enter places or selects. R rotates. Escape cancels.',
    speedN: 'Speed {n} times',
    notices: 'Notices',
    cursorTile: '{what} at column {x}, row {y}',
    emptyTile: 'Empty grass',
    skipToGarden: 'Skip to garden',
  },
  palette: {
    refund: 'refund',
    facing: 'facing {facing}',
    rotateHint: 'R to rotate',
    clickToPlace: 'click to place',
    releaseToLay: 'release to lay',
    beltsCount: '{n} belts · {cost} coins',
    beltCount: '1 belt · {cost} coins',
    removeWhat: 'Remove {name}',
    refundLine: 'refund {coins} coins',
    staysInYard: 'The {name} stays in the yard.',
    placeItem: 'Place {item}',
    needsBelt: 'needs an empty belt',
    dropHere: 'click to drop it on this belt',
    expandLine: "Opens more of the garden, about 90 tiles. You can't undo this.",
  },
  blocked: {
    headOn: 'The belt ahead points back at this one. Turn one of them.',
    stockFull: 'Blocked: plenty of those already',
    stockFullDetail: 'The Packing Station is holding enough {item}. They move on when an order needs them.',
  },
  states: {
    movesEvery: 'Moves one tile every {seconds} s.',
    growsEvery: '{item} every {seconds} s',
    outputLeaves: 'Output leaves {facing}.',
    takesAnySide: 'Takes ingredients from any side; output leaves {facing}.',
    received: 'Received {count}',
    readyCount: '{n} ready',
    packingSandbox: 'With all orders done, goods sell on arrival.',
    packingCap: 'Holds up to {cap} spare of each kind.',
    refused: 'Refused {item}: not in this recipe, or that slot is full.',
  },
  inspector: {
    recipeSeconds: '{line} · {seconds} s',
    holding: 'Holding',
    rotateTip: 'Rotate (R)',
    removeTip: 'Remove for a refund (Delete)',
  },
  celebration: {
    expansionName: 'Open Plot',
    unlockGeneric: 'You can build a {name} now.',
  },
  ending: {
    ordersFilled: 'orders filled',
    itemsDelivered: 'items delivered',
    coinsEarned: 'coins earned',
  },
  tutorial: {
    helpTitle: 'Tips',
    mouse: 'Drag on empty grass or use the middle mouse button to pan. Scroll to zoom. Click any bed, belt, or machine for details.',
  },
  errors: {
    notRemovable: 'The {name} stays in the yard.',
    packingNoFacing: 'The Packing Station takes deliveries from every side, so it has no direction.',
    undoTaken: 'That tile is taken now, so nothing changed.',
    undoFunds: 'Not enough coins to put that back.',
    basketEmpty: 'The basket has none of those.',
    expansionDone: 'The far plot is already open.',
    expansionLocked: 'More garden opens later.',
  },
  controlsExtra: [
    ['Arrows or WASD', 'Move the cursor'],
    ['Enter or Space', 'Place or select at the cursor'],
    ['Shift+R', 'Rotate the other way'],
    ['X', 'Remove tool'],
    ['Delete', 'Remove the selected structure'],
    ['B', 'Build menu'],
    ['P', 'Pause or resume'],
    ['F', 'Change speed'],
    ['= and -', 'Zoom'],
    ['Home', 'Fit the garden'],
    ['H', 'Tips'],
    ['M', 'Sound on or off'],
  ] as const,
  sound: {
    musicVolume: 'Music volume',
    musicVolumeHelp: 'How loud the tune plays.',
    sfxVolume: 'Sound effects volume',
    sfxVolumeHelp: 'Let go of the slider to hear a sample.',
    on: 'Sound on',
    off: 'Sound off',
    tooltip: 'Sound on or off (M)',
    a11yOn: 'Sound on. Press to mute the music and effects.',
    a11yOff: 'Sound off. Press to hear the music and effects again.',
  },
};

/** Leftover UI strings. copy.json `extra` wins; a missing key keeps EXTRA_FALLBACK. */
export const EXTRA = mergeExtra(EXTRA_FALLBACK, copy.extra);
