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

## Round of Nov 1, 20:47 (Sugar Belt music, irregular plot)
- **Music is now Allie's Sugar Belt soundtrack**, ported as `src/app/music.ts` and generated with Web Audio at runtime (music box, marimba, lo-fi keys and breathers over gentle progressions, modulating between keys). It starts on the first click with a 4 s fade, the music toggle and pause fade work as before, a hidden tab suspends it, and the arrangement fills out as the factory grows (machines and items on belts raise the intensity). No music file is downloaded any more: `assets/audio/music.*` stay as the audio team's source but are not loaded, and the lighter copies are gone. `tools/music-check.mjs` renders it offline: peak −11 dBFS, RMS −28 dBFS, no clipping, no silences, which matches the Sugar Belt preview recording (peak −10.4, mean −26.8).
- **The yard is no longer a box.** Plots are unions of rectangles (`src/sim/data/plots.ts`, with a tile map in the comment). The starting yard (190 tiles, about the old 192) has stepped corners, a south alcove and an east nook; Open Plot adds an east wing, a south corner, a south-west step and a north-east nook (90 tiles) rather than a rim. Opening it never moves anything. The hedge follows the real outline (inner corners are the strips cropped to their meeting square so the band turns), the closed field is tinted per tile with one traced outline and one label, and props sit in the notches.
- **Old saves keep every built tile.** A save made on the old 16×12 box (or its 20×14 expansion) gets a legacy plot id added on load that covers the old shape, so structures in what are now notches stay exactly where they were. A unit test builds a belt on all 192 old tiles and loads it; all 192 survive and are buildable. Fresh games never get the legacy ids.
- Playthrough check rerun on the new outline at 1280×800 and 1024×640 (results below). Screenshots 14–17 show the outline open, expanded, and the expanded yard at both sizes.
- One copy line changed: `extra.palette.expandLine` ("The garden grows to 20 × 14") is no longer true, so it now reads "Opens an east wing and a south corner, about 90 more tiles. Permanent." (QUESTIONS #9).

## Round of Nov 1, 19:46 (performance follow-ups + playthrough)
- **Unchanged belt views are skipped per frame.** Each belt keeps a signature (frame, facing, feeders, layout version) and only re-applies textures when it changes; feeder lookups are cached until a build action bumps `layoutVersion`; sizes/positions are set once per structure; the exit arrow is only moved when facing or zoom changes.
- **Cheaper HUD subscription.** Sim ticks mark the HUD dirty and it re-renders at most ~5 times a second (notable events such as a delivery, a craft or an order still render on the same frame). UI actions render immediately as before.
- **Fonts subset to the glyphs the game can show** (227 glyphs, `tools/subset-fonts.py`, committed as woff2): 502 KB of TTF → 51 KB of woff2.
- **Lighter music.** The audio team's `assets/audio/music.ogg` stays untouched as the source; `tools/encode-music.sh` writes a mono, lower-bitrate copy to `src/assets/audio-lite/` (committed) and the game streams that one: 1.03 MB → 336 KB on the first click (MP3 fallback 1.40 MB → 721 KB). The full-size copies are no longer in the deploy.
- Slimmer Phaser build: left alone, as asked.

| | Before (audit) | After atlas (19:30) | After follow-ups |
| --- | --- | --- | --- |
| Bytes before New Game works | 4.47 MB | 1.43 MB | 1.09 MB |
| New Game clickable, Slow 4G | 23.0 s | 7.8 s | 6.5 s |
| Fonts on the wire (raw) | 376 KB (3 TTF) | 376 KB | 38 KB (3 woff2) |
| Music on the first click | 1.03 MB | 1.03 MB | 336 KB |
| Deploy size (`dist/`) | 10.19 MB | 6.29 MB | 4.47 MB |

- **Playthrough check** (`tools/playthrough.mjs`: real clicks through qa/playthrough-checklist.md, with screenshots `producer/shots/pt-<size>-*.png`): 29/29 at 1280×800 and 29/29 at 1024×640, no console errors. It covers reading the order, tips skip/reopen, tooltips, ghost valid/invalid, place/rotate, the one-tile gap, inspector words, order 1 pay + undo-after-pay, the bundling table and its inspector, order 2, pause and 3× (one item per tile), sound/music off surviving reload, reload mid-delivery and after pay, loaded-belt removal to the basket, refused placements in words, every visible button once, and card coverage after Fit.
- One real bug found and fixed by it: the order-complete card sat mid-screen with pointer events on, so for 3.2 s it swallowed clicks on the yard beneath it. It now lets clicks through.
- At 1024×640 the whole-yard Fit cannot clear both side cards (geometry: 640 px of yard + 2 × 212 px cards > 1024). The default framing stays clear and every click landed; noted in KNOWN_ISSUES and QUESTIONS #8.

## Round of Nov 1, 19:30 (performance, from docs/research/PERFORMANCE.md)
- **Build-time WebP atlas.** `tools/pack-art.mjs` runs before dev, test and build (`sharp`). It reads `assets/art/*.png` by file name (a missing name falls back to `assets/interim/`), packs the garden sprites into one 2048×1472 WebP sheet (quality 82, 2 px extruded edges so nothing bleeds) and writes single WebP files for the toolbar icons. The PNGs stay the source of truth; Allie's redesign still drops in by name. Output lives in `src/generated/` (ignored by git). `ground.locked` is no longer preloaded. The interim PNGs are no longer in the deploy.
- **Loading bar.** The title shows "Loading the garden… 43%" while Phaser preloads; New Game enables when it is done.
- **Long cache.** `vercel.json` sends `max-age=31536000, immutable` for `/assets/*` and `max-age=0, must-revalidate` for `index.html`.
- Before / after (cold load, cache off, Slow 4G emulation, 1280×800, measured with `node tools/firstload.mjs`):

| | Before (audit) | After |
| --- | --- | --- |
| Bytes before New Game works | 4.47 MB | 1.43 MB |
| Requests before New Game works | 164 | 21 |
| New Game clickable, Slow 4G | 23.0 s | 7.8 s |
| Garden sprites on the wire | 152 PNGs, 3.80 MB | 1 WebP atlas, 0.63 MB (+30 KB JSON) |
| Deploy size (`dist/`) | 10.19 MB (278 PNGs, 5.50 MB) | 6.29 MB (no PNGs; 1.57 MB of on-demand WebP singles) |

  The 1.43 MB that remains is Phaser + app JS (1.49 MB raw, ~420 KB compressed), three Nunito TTFs (~175 KB compressed), the atlas, and the five title icons. Fonts and a slimmer Phaser build are the next cuts if wanted (not done).
- One texture for the whole yard means Phaser batches the draw instead of switching among 152 textures.
- Checks: 39 unit tests, 4 browser tests, build, `check_copy.py` all pass. Soak in the open market: 120 s at 3× with no errors and coins rising.

## Round of Nov 1, 17:15 (answers + review)
- Speed buttons now read 1×, 2×, 3× (tooltips use the copy's normal/fast lines).
- Default framing is the used part of the yard (structures + margin, at least 10×7 tiles, zoom capped) so a first chain fills the screen; Fit / Home shows the whole yard; the framing re-runs on resize.
- The closed expansion field east/south of the hedge is one soft moss-tinted lawn with a single twine outline and one "Open Plot · This costs 100 coins." label.
- Side cards shrink below 1150 px wide; at 1024×640 they still cover the yard's outer columns (the first chain stays clear). Screenshot 12 shows it.
- Art loads strictly by file name through the manifest with no size assumptions, so Allie's redesign drops in by name (docs/ART_LIST.md).
- **Push blocked:** `git push origin main` fails with "Invalid username or token" (this sandbox has no GitHub credential). All work is committed locally on `main`, three commits ahead of `origin/main`. Please pull from this machine or give the sandbox a token with push rights, and Vercel will pick it up.

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
- Optional performance follow-ups from the audit's list 4–5: skip unchanged belt views per frame, cheaper HUD subscription, font subsetting, slimmer Phaser build, lighter music file.

## Blockers
- Cannot push to GitHub from this sandbox (no credential). Commits are local on `main`.
