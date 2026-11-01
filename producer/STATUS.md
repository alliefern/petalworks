# Status

**Phase:** 2 done (first playable) · Phase 3 features built · Phase 4 polish in progress
**Last updated:** Nov 1, 2026 (evening)

## What works right now (plain English)
- Start a garden, read the order, plant a Daisy Bed, drag belts to the crate, watch daisies ride in, get paid, unlock the next tool. All six orders work end to end (Vitest proves the chains; the Playwright browser test plays order 1 with real clicks and finishes the rest through the game's own actions).
- Pause, 1×/2×/3×, undo, remove with refund, basket for recovered items, rotate before or after placing, ghost preview with valid/invalid rings and the cost.
- Inspector for every structure: state, recipe, what's inside, progress in seconds, why it's blocked.
- Status discs (`!`, `×`, check, `…`) drawn in ink on cream over the badges; ink exit arrows on everything; ink outlines on items, per the accessibility plan. One reduced-motion flag (follows the OS setting on first launch).
- Full keyboard play: arrow cursor, Enter, R, Z, X, Delete, B, P, F, Home, = / -. Dialogs trap focus; Esc closes.
- The real sound set is wired (music after first click, loops for machines and belts, blocked chime edge-triggered, final celebration on order 6). Sound and music toggles persist, including through New Game.
- Autosave (after builds, after orders, every 10 s, on tab hide). Continue / New Game with confirmation. A corrupted save is backed up and the title offers New Game. Save schema v2 with a v1 migration.
- Garden expansion (Open Plot, 100 coins) after order 4. Open market after order 6.

## What changed for the producer's revisions
- Balance numbers from BALANCE.md are in `src/sim/data/` (120 coins, new costs, 75% building refunds, full belt refunds, free pre-placed Packing Station, rewards 50/70/100/80/110/140, expansion 100).
- Architecture seams: schema version + migrations, plot ids, order board, recipe ids on machines, typed per-ingredient buffers (8), ports as data, 10 Hz tick with a tested tick order, no Date.now/Math.random in the sim.
- Strings are in one module keyed like copy.json, ready for the copy pass.

## Docs
`README.md`, `DESIGN_DECISIONS.md`, `KNOWN_ISSUES.md`, `producer/PLAYTEST.md`, `producer/QUESTIONS.md` (6 questions with defaults). Screenshots in `producer/shots/`.

## Next
- Phase 4 polish sweep: hover sounds on palette, a full-run bug check at 3×, review the 1280×800 layout, settle anything the e2e flags.
- Watch `assets/art/` for real sprites and check badge placement on them.

## Blockers
None.
