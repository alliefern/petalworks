# Status

**Phase:** Phases 1–3 complete · Phase 4 polish done for this pass · final art and final copy wired
**Last updated:** Nov 1, 2026 (late evening)

## What works right now (plain English)
- Start a garden, read Nell's order, plant a Daisy Bed, drag belts to the crate, watch daisies ride in, get paid, unlock the next tool. All six orders work end to end, then the market opens (goods sell on arrival, every tool available).
- The art team's 187 final sprites are on screen (beds, belts, machines, items, badges, hedge, decor, toolbar icons, effects). Nothing interim is visible; the generator stays as a fallback.
- The final copy (`docs/content/copy.json`) drives the HUD, order card, tips, inspector, errors and settings. `check_copy.py` passes. About 60 short strings the copy doesn't cover yet are in one place for the producer to edit (QUESTIONS #7).
- Pause, 1×/Fast/3×, undo, remove with refund, basket for recovered items, rotate before or after placing, ghost preview with the cost.
- Inspector for every structure: status in the copy's words, recipe, what's inside, progress in seconds, why it's blocked, which way it faces.
- Status discs (`!`, `×`, check, `…`) stay 28 px at any zoom; a blocked bed or machine shows its reason in a small label beside it (no banner), and screen readers hear it. Toasts are capped at two and refunds merge.
- Full keyboard play, dialogs trap focus, one reduced-motion flag, sound/music toggles persist. The real sound set is wired.
- Autosave, Continue / New Game with confirmation, corrupted-save backup, schema v2 with a v1 migration.
- Default zoom keeps tiles at least 48 px; at 1366×768 the garden sits between the tip card and the order card instead of under them; the fit re-runs on window resize (Steam-plan guardrail).

## Round of Nov 1, 17:15 (answers + review)
- Speed buttons now read 1×, 2×, 3× (tooltips use the copy's normal/fast lines).
- Default framing is the used part of the yard (structures + margin, at least 10×7 tiles, zoom capped) so a first chain fills the screen; Fit / Home shows the whole yard; the framing re-runs on resize.
- The closed expansion field east/south of the hedge is one soft moss-tinted lawn with a single twine outline and one "Open Plot · This costs 100 coins." label.
- Side cards shrink below 1150 px wide; at 1024×640 they still cover the yard's outer columns (the first chain stays clear). Screenshot 12 shows it.
- Art loads strictly by file name through the manifest with no size assumptions, so Allie's redesign drops in by name (docs/ART_LIST.md).
- Pushed to GitHub main for the Vercel build.

## For the producer's notes
- Visual review (16:47): default framing tightened and side cards clear the yard; toasts capped at 2 with merged refunds; blocked warning sits beside the building; status glyphs are ink-on-cream discs at a fixed screen size.
- Steam guardrails (§3): all kept true; `src/app/shell.ts` holds the no-op hooks. No Electron/Steam code added.
- Art: `ground_locked.png` has a per-tile border that tiles into a grid, so the closed plot is drawn as tinted lawn with one outline (QUESTIONS #9). Hedge pieces have transparent lawn, so grass is drawn under them.
- Copy: the "place a Packing Station" opening tip conflicts with the pre-placed station and is skipped (QUESTIONS #6).

## Verified
`npm test` 31/31 · `npm run build` clean · `npm run test:e2e` 3/3 (mouse-built order 1, reload mid-game, all six orders, sandbox reload, settings persistence, keyboard build, corrupted save) · 90 s headless soak at 3× with no runtime errors.

## Screenshots (`producer/shots/`)
00 title · 01 fresh garden · 02 first chain · 03 inspector · 04 all machines with a blocked bed and the keyboard cursor · 05 build ghost · 06 settings · 07 1366×768 · 08 1280×800 · 09 order-complete beat · 10 toolbar close-up · 11 top bar close-up.

## Next
- Human playtest against `qa/playthrough-checklist.md`; answer anything in `producer/QUESTIONS.md`.
- Move `EXTRA` strings into copy.json when the producer edits them.

## Blockers
None.
