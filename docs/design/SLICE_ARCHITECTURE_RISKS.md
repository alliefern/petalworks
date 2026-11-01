# Slice architecture risks

Five decisions in the first-pass build that become expensive once the longer arc in [PROGRESSION_ROADMAP.md](PROGRESSION_ROADMAP.md) exists. The slice's content stays the brief's: one meadow corner, two flowers, three products, six orders. The recommendations below are seams, not extra features to build now.

Each section says what will hurt later, then the smallest shape to commit to while the slice is still young.

## 1. Save schema

**What gets expensive.** A save that is "whatever fields the slice happens to use," a single boolean per unlock (`hasLavender`), one `activeOrderId` plus one counter, or a grid that is only a dense `16 × 12` array. The longer game adds plot ids, a recipe pin, typed slots, a filter choice, a weather index, an unlock that arrives from crafting, and a guestbook flag. Each of those is a migration. Migrations are cheap if versioned and painful if coordinates or order progress were implied by array position.

**Recommendation.**

- Put `schemaVersion: 1` on every save. `src/sim/save.ts` runs a list of pure functions, `v1 → v2 → …`, and then validates. A failed validation offers New Game and leaves the broken payload untouched in a backup key.
- Save sim state only. Do not save Phaser sprites, interpolation offsets, or React panel state. Items on belts sit on whole tiles. The renderer derives in-between motion after load.
- Give every structure and every item on a belt a stable `uid` plus a `defId` string. Identity is what makes "no duplication on load" testable.
- Store unlocks as `string[]`, not booleans. The slice's lavender unlock is just `"lavender-bed"` in that set.
- Store `unlockedPlotIds: string[]` with `"potting"` at the start and `"south-rim"` after the slice expansion. A later chapter appends an id. It does not rewrite coordinates.
- Store the order board even though the slice only pins one slip: `activeId`, `offeredIds`, `completedIds`, and `progress` as `{ orderId, delivered: { [itemId]: number } }`. A slice order has one line. The object does not care.
- Reserve `basket: { itemId: string; count: number }[]` for items returned when a structure is removed. The asset spec already has a basket icon, and the roadmap's removal rule is a full refund plus items to the basket. Voiding items on delete is the policy that will not survive contact with a Moonbloom.
- Keep settings (audio, reduced motion, tutorial) in a sibling object so a sim migration does not reset them.
- Ignore unknown fields when loading a newer save into an older build, and write `schemaVersion` you understand.

Smallest slice commitment: version field, uid + defId, unlock id list, plot id list, order progress keyed by item id, basket list. Weather can be absent and default to "no weather" on load.

## 2. Recipe data shape

**What gets expensive.** A machine definition with `inputA`, `inputB`, `output`, and `seconds` baked in, because the slice machines look one-recipe. The Drying Bench later dries chamomile too. The Flower Press later makes rose oil only when a Sunjar is nearby. The Garland Hoop takes three of one flower or two of another. The crown takes five different items. The graft's real output is an unlock id. An untyped input buffer also deadlocks the slice itself: if the Arrangement Table's only buffer fills with Daisy Bundles, the sachet can never enter, and the Mixed Bouquet order cannot complete.

**Recommendation.**

Recipes are their own records. Machines point at them.

```ts
type Recipe = {
  id: string;
  machineId: string;
  inputs: { itemId: string; count: number }[]; // empty for the apiary
  outputs: { itemId: string; count: number }[];
  durationTicks: number;
  requires?: { aura: "warmth" | "pollination" }[];
  effects?: { type: "unlock"; id: string }[]; // graft, once
};

type MachineDef = {
  id: string;
  kind: "producer" | "processor" | "transport" | "aura" | "sink";
  recipeIds: string[];
  footprint: { w: 1; h: 1 };
  // ports: see §3
};
```

A placed machine stores `selectedRecipeId`. Slice machines have one recipe; store it anyway so the inspector and the save do not grow a special case later. The player pins a recipe when a machine has more than one. The machine accepts only that recipe's inputs.

Input storage is a list of typed slots, one per input line of the selected recipe, each with a count and a cap (5). Output is a separate slot that holds the finished item until the facing tile can take it. Caps and counts are numbers of discrete items, matching "one item per belt tile." Do not switch belts to stacks later. Stacking belongs only in the packing counts and the basket.

Duration is an integer tick count in data. The brief's seconds are the designer's view; `4s` at 10 Hz is `40` ticks. See §5.

Item ids and machine ids are strings from `src/sim/data/`. Code switches on `kind` (how a structure ticks), not on `"bundling-table"`.

`effects` run after a successful craft and add to the unlock set. Running them twice is the same as running them once.

Smallest slice commitment: recipes as data, even for the five slice recipes; typed slots on the Arrangement Table and the other processors; `selectedRecipeId` saved; `kind` on each def. Aura requirements and craft effects can wait as optional fields the loader accepts and the slice leaves empty.

## 3. Port model

**What gets expensive.** "Every machine accepts from any adjacent belt and outputs on its facing" written as the only transfer rule in `transport.ts`. That sentence is the right *default* for slice machines. It is the wrong *type*. The Ribbon Gate has two outputs and a hold rule. The Sunjar has no item ports. The Packing Station has inputs and no output. A bed has one output chute. If facing is stored as "the output direction" and inputs are "every other neighbor," a gate cannot be described, and a Sunjar looks like a broken machine.

**Recommendation.**

Ports are data, in facing-relative directions:

```ts
type Port = {
  dir: "facing" | "left" | "right" | "back" | "all";
  role: "in" | "out";
};
```

Slice defaults, which reproduce the brief exactly:

- Beds: `[{ dir: "facing", role: "out" }]`.
- Processors (Bundling Table, Drying Bench, Arrangement Table): `[{ dir: "all", role: "in" }, { dir: "facing", role: "out" }]`.
- Packing Station: `[{ dir: "all", role: "in" }]`.
- Belts: one output in the belt direction, inputs from the other three sides, which is the slice's merge rule. A belt can stay a specialized transport path if the port list feels forced, as long as the *gate* is allowed to be a transport structure with an explicit port list later. Do not write `if (machine) output = facing` in the only place that moves items.

`transport.ts` moves an item from an output port onto the neighbor that port faces, and into a machine only from a belt that points at an input port. Contested destinations stay as the brief describes them: one proposed move per destination, deterministic order, no teleport, no deletion.

The gate, when it exists, is `kind: "transport"` with forward `out`, left `out`, and `in` from the back. It spends zero processing ticks. If the chosen out-port's neighbor cannot accept, the item stays. It does not fall through to the other port.

Auras are not ports. Do not overload the port list with "honey comes out of the air." An apiary has a normal output port for the jar, plus an `aura` field the grid query reads (§4 and the roadmap).

Footprint stays `{1, 1}` for every slice sprite. Keep the field on the def so a later 1×2 prop rotates its occupied cells with facing. Placement already rejects occupied tiles; multi-cell is "also check the offsets," not a new grid.

Rotation never destroys items. The brief already requires this. With typed slots and two ports, a rotation that would point an output at a blocked cell is still legal; the output simply stays blocked. A rotation that would change which port an in-flight belt item is entering should be rejected, or the item goes to the basket. Pick one and test it. Silent deletion is the bug the longer game cannot afford.

Smallest slice commitment: express the slice machines with the port list above, and resolve transfers from that list. Behavior matches the brief. The gate is then a new def, not a rewrite of movement.

## 4. Grid size

**What gets expensive.** A constant `COLS = 16`, `ROWS = 12`, a `Uint8Array` of that length as the only occupancy model, tutorials or tests that treat those numbers as the world, and an expansion that inserts rows to the north (every `y` changes, every save breaks). The full meadow is 32×22 of stable coordinates, with six plots revealed in place. Glasshouse tiles suppress weather. Showing-lawn tiles accept the finale table and refuse beds. Those are terrain rules, and they want to be data.

**Recommendation.**

- Origin is northwest, `x` east, `y` south, and the origin never moves. The potting corner is `(0,0)` through `(15,11)`. The slice expansion to 20×14 unlocks the rest of `(0,0)`–`(19,13)` and does not shift the beds the player already placed.
- Store `cols` and `rows` on the world. Prefer allocating the full **32 × 22** address space in the first save, with everything outside the open plots marked `locked`. 704 cells is nothing, and it means Chapter 1 does not resize the array. If the slice truly only allocates 20×14, still store `cols`, `rows`, and absolute coordinates so a migration can embed that rectangle at `(0,0)` of the 32×22 meadow.
- Occupancy lookup is by coordinate. A structure records `{ x, y }`, not a packed index, so a resize cannot silently point it at a different tile.
- Decorative ground stays a separate layer, as the brief already says. Locked, lawn, glasshouse, and showing are terrain ids, not occupiers. Plot records in data carry `{ id, rects, terrain, cost, unlockId }`. The save stores which ids are open.
- Placement checks three things the slice can hardcode in spirit and still structure as data: in bounds, plot unlocked, terrain allowed, cell free. Slice defs allow terrain `lawn`.
- Camera limits read the bounding box of unlocked plots.

`grid.ts` should grow one query the slice can implement and barely use: neighbors by port, and `tilesInRadius` (Chebyshev). The slice only needs neighbors. The radius function is a few lines and is what hives and Sunjars will call. Adding it later is easy; adding it is easier than discovering every caller assumed "adjacent means the input."

Smallest slice commitment: fixed origin, coordinates not packed indices, `unlockedPlotIds` for `potting` and `south-rim`, terrain field defaulting to `lawn` / `locked`, camera bounds derived from open plots. A 32×22 locked meadow is the option that avoids a resize migration entirely.

## 5. Tick rate

**What gets expensive.** Growth and crafting driven by `setTimeout`, by raw milliseconds accumulated separately in each system, or by a variable step that changes with the frame. Speed buttons that change the step size (`dt = 200ms` at 2×) desynchronize anything later that assumes a phase is "90 seconds," and they make tests depend on the machine that ran them. Saving remaining milliseconds forces every balance tweak into a float migration. Sub-tile positions saved as truth fight the brief's rule that the sim, not the renderer, owns items.

**Recommendation.**

- One fixed sim tick, **10 Hz** (100ms of sim time). It divides every duration in the brief and the roadmap: daisy 4s = 40 ticks, lavender 6s = 60, bundle 5s = 50, sachet 7s = 70, bouquet 8s = 80. Roadmap times (6s, 8s, 9s, 10s, 12s, 15s, 20s, and the 90s weather phase) are integers at 10 Hz too.
- Data stores `durationTicks`. Design notes may speak in seconds. A single constant converts them at the data boundary if authors would rather write seconds, but only if the conversion is exact. Reject a duration that is not a whole number of ticks.
- Pause, 1×, and 2× change how many ticks `game.ts` runs per animation frame. They do not change the length of a tick. 2× is two ticks, not a faster clock.
- Each producer and processor stores `progressTicks` and the `durationTicks` of the cycle it started. Save those integers. On load, the cycle continues. Do not save wall-clock timestamps.
- Belt motion is one tile per tick (or one tile per N ticks, if 10 Hz feels too fast in play; if so, lower the belt cadence with an integer, and leave the tick rate alone). The renderer interpolates between tile centers. Interpolation is a view of state, and the save records the tile.
- Run each tick in a fixed function order. The roadmap uses: weather, auras, production, transport, orders, events. Transport after production means a craft that finishes on tick T can leave onto a free tile on tick T. Write that order down in `game.ts` and cover it with a test, so a later system has a place to slot in.
- Resolve the whole transport step inside the tick, including contested destinations, before the renderer runs. The brief's acceptance test — processing time independent of frame rate — is the regression to keep.
- Weather, when it exists, advances `tickInPhase` by 1. A 90s phase is 900 ticks. No `Date.now()` in `src/sim`.
- No `Math.random()` in `src/sim`. If a cosmetic ever needs randomness, it lives in the renderer, or in an explicit seeded stream whose state is saved. The roadmap's multipliers and curated grafts are designed so the sim does not need that stream.

Smallest slice commitment: a named `TICK_HZ = 10`, durations in ticks, speed as ticks-per-frame, `progressTicks` in the save, a vitest that advances 40 ticks and asserts a daisy is ready regardless of how those ticks were batched.

## Checklist before the slice schema is called done

- [ ] `schemaVersion` is saved, and a round-trip test loads a fresh game and a finished six-order game.
- [ ] Unlocks and open plots are lists of string ids.
- [ ] Orders record delivered counts per item id.
- [ ] Recipes are records with input lists and `durationTicks`, not fields glued to one machine.
- [ ] Processors use typed input slots, so the Arrangement Table cannot fill with a single ingredient.
- [ ] Ports are data. Slice behavior still matches the brief's accept-any-side, emit-on-facing rule.
- [ ] Structure coordinates stay valid if the playable rectangle grows east and south.
- [ ] The tick is 10 Hz, and 1× / 2× only change how many ticks run per frame.
- [ ] Tick order is fixed and tested: weather, auras, production, transport, orders, events. A finished craft can leave on the same tick when the output tile is free.
- [ ] Removing a filled structure sends its items to a saved basket and refunds the full build price from the machine definition.
- [ ] `src/sim` does not import Phaser or React, and it does not call `Math.random` or `Date.now`.
