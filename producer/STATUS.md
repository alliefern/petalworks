# Status

**Phase:** Phases 1–3 complete · Phase 4 polish done for this pass · final art and final copy wired
**Last updated:** Nov 2, 2026 (03:40 UK)

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

## Round of Nov 2, 03:40 (QA walk: accessibility checklist and the acceptance plan)
Everything below ran against the current build with the tools in `tools/`, each run after the last code change. "Scripted" means a tool checks it on every run.

### qa/accessibility-checklist.md
`tools/a11ycheck.mjs` scripts 84 checks from the sheet; all pass. The three things it found are fixed in their own commits:
- Player text was under the ACCESSIBILITY §5 sizes (order panel lines, inspector body, tip card, settings help, palette names at 14 to 15 px; small caps at 12 px). Body text is now 16 px and the small caps sit on the 14 px floor.
- Top-bar buttons were 40 px tall and the speed buttons 43 px wide; now 44 px or more.
- At 200% browser zoom the top bar clipped off the right edge; it now wraps to a second row and the side cards start below it.
- The valid-placement ring was a sage stroke on sage grass and vanished in grayscale; it is now cream with an ink hairline and heavier brackets (checked on a grayscale sheet of the rings, discs, badges, items and bed states).

| Section | Result | How it was checked |
| --- | --- | --- |
| State and contrast | Pass | Scripted: coins, order, tip, top bar and inspector text are dark ink on cream at 7:1 or better; blocked shows the ! disc, the badge and a sentence with the reason; waiting names the missing daisies with the … disc; ready says Ready; the four discs and three placement shapes are distinct drawings; a closed plot and an outside tile refuse in words; the inspector gives the facing as a word. Grayscale sheet reviewed by eye: !, ×, check and … differ; daisy, lavender, bundle, sachet and bouquet differ; empty, sprouting, budding and blooming beds differ. |
| Reduced motion | Pass | Scripted: one toggle with the "garden keeps going" line; flag set on the document; items still ride belts; chevrons hold still; survives reload. |
| Keyboard | Pass | Scripted: Tab reaches pause, speeds, sound, undo, tips, settings, the build menu and the garden, each with a 2 px focus ring; arrows move the cursor; Enter places and charges once; R and Shift+R; Esc disarms; a belt path from Enter, arrows, Enter; Esc drops a path; Enter selects and the inspector shows status and facing; Delete, Z, X; P and F; Settings and the New Game confirm trap focus and Esc returns to the garden. |
| Type and the laptop window | Pass | Scripted at 1366×768 and 1280×800: order and inspector text 16 px or more; every visible button at least 44×44 with a word or spoken label; default tiles 48 px or more with the build menu open. At 200% zoom the order sentence is whole and the top bar wraps. |
| Sound | Pass | Scripted: no audio context before the first click; effects and music are separate flags with On and Off in words; both survive reload and New Game; a refused placement shows the sentence; a block shows one label and no repeating toasts. Not scripted: hearing each cue; the bloom and pop cues fire from the same events that swap the sprite. |
| Later rows | n/a | Volume sliders now exist (Nov 2); remappable keys, high-contrast theme and caption history remain post-slice. |

### qa/ACCEPTANCE_TEST_PLAN.md (59 tests)
| Tests | Result | Evidence |
| --- | --- | --- |
| 1 to 5 (commands, dev server, build, unit tests, browser smoke) | Pass | `npm test` 58, `npm run build` clean with tsc, `npm run test:e2e` 6 of 6, `check_copy.py` passes. |
| 6 to 13 (new game, silence first, art, layout, no character, wording, tutorial, no modals) | Pass | Playthrough script 29 of 29 at 1280×800 and 1024×640; a11y script (silence until the first click); `check_copy.py` rejects British spellings; layout script at five sizes; the order-complete card lets clicks through. First-launch look reviewed on screenshots 01, 18 and 19. |
| 14 to 27 (tooltips, ghost, place, refusals, rotate, drag belts, pan and zoom, delete, undo, cancel, autosave, pause and speed, sound settings, every control) | Pass | Playthrough script (tooltip words and cost, ghost valid vs bad, place, rotate both ways, refused in words with coins unchanged, loaded-belt removal to the basket, undo after pay, pause freezes, 3× faster with one item per tile, settings survive reload, every HUD button clicks). Belt drags: `tools/beltloop.mjs` lays rings by dragging and checks one piece per tile. Pointer and zoom: `tools/pointercheck.mjs` at three sizes, two DPRs and three zooms. Sound cues by ear are not scripted. |
| 28 to 45 (the six orders, reloads mid-transport and mid-craft, autosave, softlock budget, catalog lock, sandbox, completed save, console) | Pass | e2e: order 1 by mouse, all six orders, reload mid-game, completed save reloads into the sandbox; unit tests: every order from real chains, never unaffordable, catalog gating, packing never counts undelivered items; 90 s soak at 3× in the open market with no console errors. |
| 46 to 55 (contested merge, head-on, remove with items, rotate loaded, very fast, hidden tab, CPU throttle, bounds and expansion, refunds, accessibility) | Pass | Unit tests: contested destination is deterministic and loses nothing; head-on refused; packed line moves as a unit; removal refunds belts 100% and buildings 75% and sends held items to the basket; rotating keeps the item; expansion gated and paid once; no duplication across a busy network. Soak at 3×. Hidden tab pauses the garden (DESIGN_DECISIONS, 250 ms cap). CPU throttle: at 4× slowdown the sim still runs 10.0 ticks a second (10.0 unthrottled). Accessibility: the sheet above. Note: the plan still says a 16×12 grid growing to 20×14; the yard is now the irregular plot the producer asked for (about 190 tiles, 90 more after Open Plot), and the bounds tests check that shape instead. |
| 56 to 59 (broken save, New Game confirm, wasted budget, known limitations) | Pass | e2e: broken JSON, and a save from a newer version, explain themselves in plain words and offer New Game while keeping a backup; New Game asks first, Cancel keeps the garden across a reload, Confirm starts order 1 with 120 coins and the tips; unit: refunds let a wasted budget recover and cumulative rewards cover every order; KNOWN_ISSUES and DESIGN_DECISIONS state the removal, refund and hidden-tab rules. |

Not covered by any script and still for a human: listening to each sound cue under its condition (plan 26 table), and the "looks painted and calm" judgement in plan 8.

## Round of Nov 2, 00:50 (Allie's playtest: belts, size jump, overlap)
- **Belts fixed (playtest item 1).** Every placed building popped in with a scale tween that ended at scale 1, which is the raw 2x art, so each belt tile was drawn two tiles wide and the next tile's corner or straight piece showed on top of it ("straight and turning at the same time"). The pop-in now ends at the tile size, and the view sizes a building only after its real sprite is loaded. Each belt tile shows exactly one piece (straight, clockwise corner, counter-clockwise corner, or an end stop on a dead end) chosen from its neighbors by `src/game/beltPiece.ts`, which has a unit test for all four rotations of each piece, merges, and every feeder combination. `tools/beltloop.mjs` lays two rings by dragging (one each way), a side merge, a rotated belt and a removed mid-line belt, then checks every belt tile draws one 64 px piece. Screenshot 18 shows both loops.
- **Overlap on big screens and placement size (items 4 and 2).** Every building takes exactly one tile in the simulation, and `canPlace` refuses any occupied tile; a new unit test rings a machine with beds and machines on all eight sides and checks every kind, through both the single-place and the dragged-belt paths, is refused on every full tile. What Allie's husband saw was the drawing bug above: a placed machine painted two tiles wide looked like it sat on its neighbor. `tools/pointercheck.mjs` now drives the real mouse at 1920x1080, 2560x1440 and 3840x2160, at 1x and 2x device pixel ratio, at three zoom levels: the hovered tile matches the tile under the pointer (center and near-corner points), the ghost sits on that tile, the placed building ends exactly the ghost's size, and a second click on a full tile changes nothing. All six combinations pass (the canvas is not yet DPR-sharp at 2x; that is item 5, next).
- **Responsive layout and sharpness, 1024x640 to 4K (item 5).** The canvas now renders at the device pixel ratio (capped at 2x, within a 16-megapixel budget), so a 2x laptop or monitor shows crisp sprites instead of an upscaled 1x canvas; pointer, ghost and placement math all account for it (`tools/pointercheck.mjs` passes at 1920x1080, 2560x1440 and 3840x2160, 1x and 2x). On very wide windows the HUD scales up (1.3x from 2200 px, 1.6x from 3000 px) so it is not tiny on 4K. Fit now frames the yard in the real free column, measured from the HUD cards themselves (top bar, palette, tip and order cards), which also fixed a sign error that pushed the yard toward the order card and under the palette. When the whole yard cannot sit beside both side cards at the 40 px tile floor, Fit closes the tip card (Tips brings it back). `tools/layoutcheck.mjs` checks, at 1024x640, 1280x800, 1920x1080, 2560x1440 and 3840x2160, that the default framing keeps the first chain clear, that after Fit every open tile is on screen and no side card covers any of it, that the yard is centered in the free column, and that the HUD scaled; screenshots are `producer/shots/19-responsive-<size>.png`. One leftover: a 640 px tall window cannot show all 14 rows at the 40 px floor, so at 1024x640 after Fit the top and bottom rows sit a few px under the top bar and the Build button (answered in ANSWERS #11: Fit alone may now go down to 34 px tiles on windows shorter than 700 px, so at 1024x640 the whole yard is fully on screen after Fit; everything else keeps the 40 px floor).
- Checks after this round: 57 unit tests, tsc, `check_copy.py`, 4 of 4 browser tests, playthrough 29/29 at 1280x800 and 1024x640, plot edge check, belt loop check.
- **Sound controls (item 3).** A speaker button sits in the top bar next to the speed buttons (also the M key): it mutes music and effects together, shows a clear off state, is keyboard reachable with a spoken label, and is remembered between sessions. Settings has two sliders, Music volume and Sound effects volume (0 to 100), saved with the other settings; letting go of the effects slider plays a short sample at the new level. Muting never changes the slider levels. New strings live in `docs/content/copy.json` under `extra.sound` (and in COPY.md); `check_copy.py` passes again (it had been failing on the reworded Open Plot line). Unit test for the saved levels (clamped, defaulted for older saves) and the e2e settings test cover it.

## Round of Nov 1, 20:47 (Sugar Belt music, irregular plot)
- **Music is now Allie's Sugar Belt soundtrack**, ported as `src/app/music.ts` and generated with Web Audio at runtime (music box, marimba, lo-fi keys and breathers over gentle progressions, modulating between keys). It starts on the first click with a 4 s fade, the music toggle and pause fade work as before, a hidden tab suspends it, and the arrangement fills out as the factory grows (machines and items on belts raise the intensity). No music file is downloaded any more: `assets/audio/music.*` stay as the audio team's source but are not loaded, and the lighter copies are gone. `tools/music-check.mjs` renders it offline: peak −11 dBFS, RMS −28 dBFS, no clipping, no silences, which matches the Sugar Belt preview recording (peak −10.4, mean −26.8).
- **The yard is no longer a box.** Plots are unions of rectangles (`src/sim/data/plots.ts`, with a tile map in the comment). The starting yard (190 tiles, about the old 192) has stepped corners, a south alcove and an east nook; Open Plot adds an east wing, a south corner, a south-west step and a north-east nook (90 tiles) rather than a rim. Opening it never moves anything. The hedge follows the real outline (inner corners are the strips cropped to their meeting square so the band turns), the closed field is tinted per tile with one traced outline and one label, and props sit in the notches.
- **Old saves keep every built tile.** A save made on the old 16×12 box (or its 20×14 expansion) gets a legacy plot id added on load that covers the old shape, so structures in what are now notches stay exactly where they were. A unit test builds a belt on all 192 old tiles and loads it; all 192 survive and are buildable. Fresh games never get the legacy ids.
- Playthrough check rerun on the new outline: 29/29 at 1280×800 and 29/29 at 1024×640, no console errors; 45 unit tests, 4 browser tests, build and `check_copy.py` pass. Screenshots 14–17 show the outline open, expanded, and the expanded yard at both sizes.
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
- Human playtest against `qa/playthrough-checklist.md`; answer anything in `producer/QUESTIONS.md` (#11 is the only open one from this round).
- Allie's redrawn hedge art drops in by file name when it lands; the hedge line is already continuous.
- Optional performance follow-ups from the audit's list 4–5: skip unchanged belt views per frame, cheaper HUD subscription, font subsetting, slimmer Phaser build, lighter music file.

## Blockers
- None. Commits land on `main` here and the producer pushes them at each check-in.
