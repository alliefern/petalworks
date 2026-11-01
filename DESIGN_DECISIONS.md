# Design decisions

Short notes on the choices the brief left open, and why. Policies the acceptance plan asks about are marked **Policy**.

## Architecture

- **Three layers.** `src/sim` is pure TypeScript with no framework imports, no `Math.random`, no `Date.now`. `src/app/store.ts` owns the sim at runtime and runs the loop. Phaser (`src/game`) and React (`src/ui`) both read the store; neither owns inventory or timers.
- **Fixed 10 Hz tick.** `TICK_HZ = 10`; every duration in data is integer ticks (`seconds()` throws on a non-integer result). Speed buttons change how many ticks run per frame, never the tick length. The renderer interpolates item positions between tile centers using the fraction of the next tick that has elapsed.
- **Tick order** (fixed, tested): transport (belts advance and transfer), production (beds grow, machines craft, both push output), orders (deliveries allocate). A craft that finishes on tick T leaves on tick T when its output tile is free. Transport runs before production so a bed can refill a tile that was just vacated, which avoids a one-tick "blocked" flicker.
- **Deterministic transfers.** Belts are processed in id order. For each contested destination the feeder directly behind wins, then the right side, then the left. Transfers repeat in passes so a packed line advances as a unit. One item per belt tile; items never move into an occupied tile and never skip a tile.
- **Ports are data.** Every structure definition lists facing-relative ports (`facing/left/right/back/all`, `in/out`). Beds: one output. Processors and packing: input on all sides; processors output on the facing side. Belts: output facing, input from the other three sides. `transport.ts` resolves moves from those lists, so a two-output gate later is a new definition, not a rewrite.
- **Recipes are records** (`src/sim/data/recipes.ts`). Each placed machine stores its `recipeId`. Input buffers are typed per ingredient (8 each), so an Arrangement Table cannot fill with bundles and starve the sachet. One output slot.
- **Grid.** Fixed northwest origin; absolute coordinates on every structure. Plots are data (`potting` 16×12, `south-rim` 20×14). Opening the expansion appends a plot id and never moves anything.
- **Save schema v2** with ordered migrations (v1 → v2 exists and is tested). Sim state only; settings live beside it so a sim migration never resets them. A broken save is backed up under `petalworks.save.backup` and the title offers New Game.

## Economy and rules

Numbers follow `docs/design/BALANCE.md`: 120 starting coins; Daisy Bed 20/15, Belt 2/2, Bundling Table 40/30, Lavender Bed 40/30, Drying Bench 60/45, Arrangement Table 80/60; rewards 50, 70, 100, 80, 110, 140; expansion 100, no refund.

- **Policy: Packing Station is part of the yard.** It is pre-placed, free, and cannot be built or removed. A save that lost it gets it back on load.
- **Policy: removal returns items to the basket.** Removing a structure that holds items moves them to a visible basket in the build palette; the player picks one and clicks an empty belt to send it back out. Nothing is ever silently deleted. (BALANCE.md modelled a "block removal" rule instead; the architecture doc asks for the basket, and it is the friendlier fix for a stuck line. Flagged in `producer/QUESTIONS.md`.)
- **Policy: rotation never destroys items.** A belt holding an item can be rotated; the item keeps riding from its entry side to the new exit. Machines keep their buffers.
- **Policy: the celebration beat holds the garden.** After an order packs, a non-modal card shows for about three seconds and the sim pauses, so a slow reader does not pre-finish the next order. Order 6 opens the completion dialog instead, which also holds the sim.
- **Policy: a hidden tab pauses the garden.** Animation frames stop when the tab is hidden and the loop never catches up more than 250 ms, so returning does not bury the garden in flowers.
- **Sandbox.** After order 6 the market opens: every delivered good sells on arrival for a small coin value, every tool is unlocked, the expansion stays available. No generated orders in this pass.
- **Undo** reverses place, belt-path, rotate and remove when safe. It refuses (with a message) when it would drop items or when the tile is now taken, and it never rewinds an order or re-pays a reward.

## Art

- Source art is `assets/art/<file>.png`, by file name (a missing name falls back to `assets/interim/<file>.png`). `tools/pack-art.mjs` runs before dev, test and build and writes `src/generated/`: one WebP atlas for the garden (frame name = file stem, identical pixels share a frame, 2 px extruded edges) plus single WebP files for `<img>` use. `src/assets/manifest.ts` reads only the generated output, so the game loads one texture instead of 152 and about a third of the bytes. A facing variant that is missing falls back to the east-facing frame plus a runtime rotation.
- Hedge pieces have transparent lawn under the foliage, so a grass tile is drawn beneath each one. The closed plot is lawn under a moss tint with one outline (the locked tile art has a per-tile border; see `KNOWN_ISSUES.md`).
- Status and selection are drawn in code over whatever pennant art arrives: cream discs with ink glyphs (`!`, `×`, check, `…`), ink-stroked tile rings with distinct shapes, an ink exit arrow on every bed, belt and machine, and an ink outline behind every item on a belt. This follows `docs/design/ACCESSIBILITY.md`.

## Controls

Left-click places/selects, drag lays belts, right-click or Esc cancels, R / Shift+R rotates, Z undoes, X arms Remove, Delete removes the selection, B toggles the build menu, P pauses, F cycles speed, wheel zooms, middle-drag or drag-on-grass pans, Home fits. The garden is one keyboard widget: arrows/WASD move a cursor, Enter/Space places or selects, a polite live region announces the tile. Browser shortcuts (Ctrl+R etc.) are left alone; only Ctrl/Cmd+Z is bound.

## Audio

Cues come from `assets/audio/` via the manifest's suggested gains. Nothing plays until the first click or key. Music, the machine hum and the belt cadence are single looping instances; the two factory loops stop while paused and music fades. `blocked` is edge-triggered after a block has lasted a second, and again if the reason changes. Order 6 plays `final_celebration` instead of `order_complete`.

## Copy

`docs/content/copy.json` is the source of player-facing text; `src/ui/strings.ts` is a thin facade over it (camelCase copy ids ↔ snake_case sim ids, placeholder filling from balance data). Strings the copy pass has not covered yet sit in `EXTRA` in the same file with the same key style, so moving them into copy.json is a key rename, not a code change. Sim errors are codes; the store maps them to copy.

## Desktop shell readiness

Per `docs/research/STEAM_PLAN.md` §3: `base` is `./`, assets never inline, saves go through `SaveStore` (`localStorageStore` / `memoryStore`, a file store later), `schemaVersion` plus migrations, no browser APIs in `src/sim`, every action has a button as well as a key, the fit rule re-runs on window resize, and `src/app/shell.ts` holds no-op hooks (order completed, saved, open link) a shell can replace.

## Next priorities

1. Human playtests of balance and the tips; the e2e harness drives the sim faster than a person.
2. Move the `EXTRA` strings into copy.json once the producer edits them.
3. Mobile/touch is planned but not built.
