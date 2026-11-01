# Revisions from the producer


## 2026-11-01 15:30 UK — sound set landed
- The sound set is merged into main and pulled locally under `assets/audio/` (ogg + mp3 fallback). `assets/audio/AUDIO_MANIFEST.md` lists every cue key, loop flag, suggested gain and when to play it, plus a mapping from the old names in `docs/ASSET_SPECS.md` §11.
- When you reach the audio step, wire these in using the manifest (respect the suggested gains, music off until first interaction, a mute toggle that persists in the save). Don't edit files under `assets/audio/`; ask in QUESTIONS.md if a cue is missing.
- Real art from the art team is in progress (grass, belts, daisy beds, bundling and packing machines so far, and it looks on-brief). Keep your interim art pipeline swappable by filename per ASSET_SPECS.md; I'll drop accepted sprites into `assets/art/` and note it here.

## 2026-11-01 15:50 UK — side work merged: architecture seams, copy, QA plan, deploy notes
Four docs-only PRs are merged and in main (merged with your local commits, nothing of yours changed):
- `docs/design/SLICE_ARCHITECTURE_RISKS.md` — **please act on this now, before the visual proof grows.** Your sim core already exists, so check it against the five seams and adjust where it's cheap today and expensive later:
  1. Save: `schemaVersion` + ordered migrations; save sim state only; stable `uid` + `defId` on every structure and belt item; unlocks as `string[]`; `unlockedPlotIds`; order board as `activeId/offeredIds/completedIds/progress.delivered[itemId]`; a `basket` list for refunds on removal; settings in a sibling object.
  2. Recipes as data records that machines point at (`recipeIds`, saved `selectedRecipeId`), typed input slots per recipe line with a cap, separate output slot, durations as integer ticks, code switches on `kind` not on machine id. (Note the deadlock it flags: an untyped Arrangement Table buffer can fill with bundles and block the sachet.)
  3. Ports as facing-relative data (`facing/left/right/back/all`, `in/out`); transport resolves moves from port lists, not `if machine then output = facing`.
  4. Grid: fixed northwest origin that never moves, `cols/rows` stored on the world, absolute coordinates; ideally allocate the full 32×22 with locked cells so the 20×14 expansion doesn't shift anything.
  5. Tick: fixed-rate integer ticks (10 Hz suggested), speed buttons run more ticks rather than bigger steps, no setTimeout or per-system ms accumulators.
  Keep the 26 tests green and add tests for any change (e.g. no duplication across save/load by uid, rotation never deletes items). The brief still wins on behavior; these are about data shape. Write a line in STATUS.md on what you changed.
- `docs/design/PROGRESSION_ROADMAP.md` — the post-slice chapters. Read for context only; don't build past the slice.
- `docs/content/copy.json` + `COPY.md` — first-pass player-facing text. **Don't wire it in yet.** I still have to edit it for voice and Allie is deciding capitalization. Keep your own placeholder strings in one place (a strings module keyed like copy.json) so swapping is one step.
- `qa/ACCEPTANCE_TEST_PLAN.md` — the acceptance checks I'll run when you claim a phase done. Worth reading so nothing surprises you.
- `docs/research/DEPLOY_AND_PACKAGING.md` — Vercel notes (asset paths/`base`, caching, ogg+mp3). Follow it when you set up the build so it deploys as a static site with relative asset paths.

## 2026-11-01 16:01 UK: capitalization decided
Allie decided in-game text uses normal capitalization (not all lowercase). See docs/PRODUCER_NOTES.md. Use normal capitalization for any UI strings you write. The producer will do a final copy pass on docs/content/ before you wire it in.

## 2026-11-01 16:10 UK: balance numbers and accessibility plan merged
Two more docs-only PRs are in main (nothing of yours touched):
- `docs/design/BALANCE.md` + `tools/balance/simulate.py` — **use these numbers, kept as data (a balance/defs table), not hardcoded in logic:** 120 starting coins. Costs/refunds: Daisy Bed 20/15, Belt 2/2, Bundling Table 40/30, Lavender Bed 40/30 (unlocked by order 4), Drying Bench 60/45 (order 5), Arrangement Table 80/60 (order 6). 20×14 expansion costs 100, no refund, optional, offered after order 4. Packing Station is free, pre-placed, cannot be sold. Order rewards 50, 70, 100, 80, 110, 140. Belts move one tile every 0.5s (5 ticks at 10 Hz). Grow/craft times stay as the brief says.
- `docs/design/ACCESSIBILITY.md` + `qa/accessibility-checklist.md` — **follow it for the slice**, especially: (1) status pennants get an ink glyph on a cream disc drawn over the pennant art, because the painted pennant colors fail contrast; (2) one `settings.reducedMotion` flag (honors prefers-reduced-motion by default) that calms bobbing/particles/camera moves; (3) the bare-key keyboard map in the doc, leaving browser shortcuts alone; (4) a visual cue for every sound cue; (5) music and sound mute toggles persisted in the settings object. I'll tick the checklist when reviewing builds.

## 2026-11-01 16:25 UK: Steam guardrails
Allie plans a Steam release later (Electron wrapper, steamworks.js). Read section 3, "What the current build should keep true", of docs/research/STEAM_PLAN.md and follow it now, so Steam stays easy. Don't add Electron or Steam code yet. Note anything you change in STATUS.md.

## 2026-11-01 16:30 UK: first real art landed
- Accepted final art is now in `assets/art/` (untracked, please commit it with your next commit): `ground_grass_0..3`, `item_daisy`, `machine_packing_idle`, `machine_packing_receive0..3`. These are complete sets, so they replace their interim stand-ins cleanly through the manifest.
- I held back belts, daisy beds and the bundling table until every frame and facing exists, so you won't get real and interim frames mixed in one animation. Check the manifest falls back per file and that 144×144 sprites with the 8 px overhang sit centered on their tile. Take a fresh screenshot of the first chain once it's in.

## 2026-11-01 16:40 UK: game copy is ready to wire in
The voice and capitalization pass on docs/content/ is merged (PR #9). docs/content/copy.json is the final text: wire it in for all player-facing strings, replacing the older customer names and placeholder text in the sim. Fill the {coins} and {cost} placeholders from the balance data. src/sim/data does not match docs/design/BALANCE.md yet, so update it to those numbers (see the earlier balance note). Unlock timing: a building becomes available as the order that needs it starts, which is the same moment the previous order packs. Keep the sim's unlock-on-order-start behavior, and make the unlock set match BALANCE.md (Lavender Bed with order 4, Drying Bench with order 5, Arrangement Table with order 6, optional expansion from order 4). Run python3 docs/content/check_copy.py after wiring.

## 2026-11-01 16:47 UK: visual review of 04-all-machines.png
1. Buildings read too small and sparse on the grass, and most of the yard is empty lawn. Check tile scale against ASSET_SPECS (64px tiles), make sure buildings fill their tile footprint, and consider a default zoom that frames the playable yard more tightly.
2. Toasts stack up 4 deep at the top center and cover the garden. Cap visible toasts at 2, merge repeated coin-refund toasts, and keep the blocked warning near the building, not as a big banner.
3. The status bubble icons ("...", "!") are tiny. Follow docs/design/ACCESSIBILITY.md: ink glyphs on cream discs, readable at 100% zoom.
4. The tip card and order card both float over the yard. Make sure neither covers the playable grid at 1366x768.

## 2026-11-01 16:47 UK: most of the final art landed
- 149 more accepted sprites are in `assets/art/` (untracked, commit them with your next commit): every belt frame (straight, corner cw/ccw 0..7, belt_end), daisy and lavender beds in all four facings and states, the bundling table, drying bench and arrangement table in all facings and frames, the hedge edges and corners, ground_locked, all five items (the daisy bundle is now bigger), tile_valid/invalid/select, and the four status badges.
- The badges have the spec's cream glyph painted in. Keep the accessibility plan's ink glyph on a cream disc drawn on top; it should cover the painted one cleanly. Check it reads at 1x.
- Still to come from the art team: the UI icons (only a few exist, so I'm holding them so the toolbar doesn't mix styles), decor, and fx petals/sparkle/ring. Interim stays for those.
- After wiring copy and balance, take fresh screenshots (first chain and all machines) so I can check scale, centering of 144×144 sprites with the overhang, and belt animation direction against the ports.

## 2026-11-01 16:55 UK: the rest of the real art landed
Codex finished. All decor_*, fx_* and ui_* sprites are now in assets/art/ (187 total). Swap the stand-in toolbar icons, decorations and petal effects for these, commit the art, and take fresh screenshots (title, a full garden, the toolbar close up). Allie wants to judge the real style from those.

## 2026-11-01 17:15 UK: review of the 17:08 screenshots, and a live build
- QUESTIONS.md 1-6 are answered in ANSWERS.md (all your defaults stand; make the speed labels consistent).
- The game is now on Vercel, deploying from GitHub main on every push (project "petalworks", protected by Allie's Vercel login). Keep `npm run build` producing `dist/`, and commit + push your current work and the untracked decor_/fx_/ui_ art soon, so the live build gets it.
- 04-all-machines.png: toasts are fixed (one at a time), good. Still to do: (1) the buildings still read small against a mostly empty lawn; frame the yard tighter by default (Fit to the used area plus a margin, or zoom in a step) so a first chain fills more of the screen; (2) the locked expansion area east of the hedge reads as a grid of separate hedge boxes; show it as one soft, faded locked field with a single "Open Plot, 100" label; (3) the Tip card's left edge overlaps the hedge at 1024 width; check 1024×640 and 1280×800 so no card covers playable tiles.
- Allie is redesigning the art herself; her files will replace Codex's under the same names (see docs/ART_LIST.md). Keep loading art strictly by file name through the manifest, with no size or frame-count assumptions beyond ASSET_SPECS, so her drop-in works.

## 2026-11-01 17:30 UK: review of screenshots 02 and 12
- 02 (first chain at 1024 wide) looks good: the chain fills the screen and nothing covers it.
- 12 (1024×640): the view shows the whole yard and the bed and station are tiny. If that's the default framing at this size, apply the same used-area framing there. If it's after pressing Fit, that's fine.
- 12: the "Open Plot · This costs 100 coins." label is clipped at the right edge of the window and sits under the order card. Keep it on screen (clamp it inside the viewport, clear of the side cards) or hide it when its anchor is off screen.
- Pushing is handled by the producer; ignore the push blocker.

## 2026-11-01 17:40 UK: leftover UI strings edited
PR #11 is merged. docs/content/copy.json now has an `extra` section with edited versions of the leftover UI strings, using the same key names as EXTRA. Switch those strings over to read from copy.json `extra`, then run python3 docs/content/check_copy.py and commit.

## 2026-11-01 17:50 UK: while you were paused
Your last run stopped on the usage limit (resets 19:30 UK). A Cursor side agent is doing the two open items on a PR: wiring copy.json `extra` in place of EXTRA, and keeping the Open Plot label on screen at 1024x640. When you resume, pull main first; if that PR has merged, skip those two items. Your uncommitted tools/soak.mjs change (open market in the soak) is untouched; finish and commit it.

## 2026-11-01 18:10 UK: side PR #12 merged
PR #12 is merged and on main: the UI now reads the leftover strings from copy.json `extra` (EXTRA is gone) and the Open Plot label stays on screen at 1024x640. Skip both of those items. Tests (39) and build pass on main. When you resume after 19:30, pull main, finish and commit your tools/soak.mjs change, then carry on with the next phase in STATUS.md.

## 2026-11-01 18:45 UK: performance fixes (after current polish)
docs/research/PERFORMANCE.md (PR #13) is merged. The game downloads 4.45 MB before New Game works (23 s on slow 4G), mostly 152 separate PNGs. Do the fixes in its ordered list. Key points:
- Generate WebP and/or a texture atlas at BUILD time from assets/art/*.png. Keep the PNGs in assets/art/ as the source of truth with the same file names, because Allie will drop in redesigned art by file name. Make resolveSprite prefer the built format.
- Let the player start sooner, by loading only what the opening needs before New Game, or by showing progress.
- Long-cache the hashed files (vercel.json headers: immutable, max-age=31536000 for /assets/*).
Keep the tests green and note the before and after sizes in STATUS.md.

## 2026-11-01 19:31 UK: resumed
Resumed your session (run2) after the limit reset with the 18:10 and 18:45 items: finish and commit tools/soak.mjs, finish polish, then the performance fixes.

## 2026-11-01 19:46 UK: performance pass reviewed
Pulled your work, pushed through 48df348; 39 tests and the build pass here, and 13-title-loading.png looks good. Question 7 is answered (keep "Loading the garden"). Next, in this order:
1. The optional performance follow-ups: skip unchanged belt views per frame, cheaper HUD subscription, subset the Nunito fonts to the glyphs the game uses, and a lighter music file (keep the source file, encode a smaller one at build time or commit a compressed copy). Leave the slimmer Phaser build for now unless it's quick and safe.
2. Then a full playthrough check of your own against qa/playthrough-checklist.md at 1280x800 and 1024x640, fix anything that fails, and refresh the screenshots.
Keep tests green, update STATUS.md with new before/after numbers, and commit as you go.

## 2026-11-01 20:35 UK: use the Sugar Belt music (Allie's call)
Allie wants Petalworks to use the music from her other game, Sugar Belt, because it fits better. It's her own code, so reuse is fine.
- Source: /workspace/marshmallow-factory/game/src/music.ts (generative Web Audio soundtrack, no sample files). Check audio.ts next to it for anything music.ts depends on, and scripts/music-check.mjs for how it renders and checks levels. /workspace/marshmallow-factory/music-preview.mp3 is a recording of how it should sound.
- Port it into Petalworks as the background music, replacing assets/audio/music.mp3/.ogg playback. Keep the existing music volume and mute settings working, start it on the first user gesture, and keep the levels from clipping.
- Remove the music.mp3/.ogg download from the load if nothing else uses it.
- Keep the tests green and note it in STATUS.md.

## 2026-11-01 20:47 UK: playthrough reviewed, next items
Pushed your run through 43b1712; 39 tests and the build pass here. The click-through fix and the inspector height look right. Q8 is answered in ANSWERS.md. Next, in this order:
1. The 20:35 item above: port the Sugar Belt music (you haven't seen it yet).
2. A non-square garden plot (Allie's call). She doesn't want the plot to read as a plain box. Give the starting plot an irregular, garden-like outline: for example notched or stepped corners, a bulge or alcove along one edge, and the expansion as an oddly shaped extension rather than a uniform rim. The plots data already works as a union of shapes ("a tile is buildable if any open plot covers it"), so build the outline from several rects (or a tile mask) in src/sim/data/plots.ts, keep it data, and keep opening a plot from never moving anything built. The hedge and the closed-field tint/outline must follow the real outline, not a bounding box. Keep the first chain's space and the balance numbers workable, keep save migration working (old saves keep their built tiles), keep the default framing on the used area, and recheck 1280×800 and 1024×640. Add a test that every tile of the old starting plot that a save could have built on is still valid or is migrated cleanly.
3. Refresh producer/shots/ (include the new outline, open and expanded), keep tests green, update STATUS.md, and commit as you go.

## 21:07 UK, producer
- Run4 stalled mid-thought around 20:51 with no output; I stopped it and resumed as run5. Commit the finished Sugar Belt music port first, then carry on with the irregular plot outline.

## 2026-11-01 21:12 UK: plot shape reference from Allie (read before finishing the plot outline)
Allie answered: "Make the plot an organic, irregular garden shape... like the edges of the plots in Northgard."
What that means here, based on Northgard's territory borders:
- The edge is a smooth, wobbly, hand-drawn-looking curve, not a stair-step of tile edges and not a perfect circle. Lumps and inlets of different sizes, like land shaped by nature.
- The outline reads as one clear, continuous border line (soft and slightly glowing or painted), sitting on top of the ground, with the hedge following it.
- Outside the border the ground fades softly into the surroundings instead of ending at a hard rectangle.
- Gameplay stays on the tile grid: only tiles inside the shape are buildable. The curve is drawn around those tiles, smoothed.
- Expansions should grow the shape organically along the same kind of curve, not add a rectangle.
Take screenshots at 1280x800 and 1024 wide and put them in producer/shots/.

## 2026-11-01 21:13 UK: Allie's playtest bugs and requests (do right after the plot outline, before anything else)
1. **Belts are broken (bug, top priority).** Allie: "they go all straight and then also turn at the same time, overlapping." A belt tile is drawing a straight sprite AND a corner sprite at once. Each belt tile must show exactly one piece, chosen from its neighbors: straight, corner (correct direction), or end. When a neighbor changes, the old piece is replaced, never stacked. Check every rotation, placing belts by dragging, removing a belt mid-line, and loading a save. Add a unit test for the belt-piece choice and screenshot a belt loop with all four corner types to producer/shots/.
2. **Machines change size when placed (bug).** The hover/placement ghost is one size and the placed building is bigger. The ghost must use the exact same sprite, scale, anchor and footprint as the placed building, so placing it causes no visible jump. Check every machine and bed, at all zoom levels.
3. **Sound controls.**
   - Put a visible sound on/off toggle on the main screen (top bar, near the speed controls), not only inside Settings. Speaker icon, clear on and off states, keyboard reachable, with an aria-label, and remembered between sessions.
   - In Settings, add two sliders: Music volume and Sound effects volume (0-100), saved between sessions, with the effects slider playing a short sample sound when you let go of it. The main toggle mutes everything without losing the slider levels.
   - Use normal capitalization in labels. Add any new strings to docs/content/copy.json.
Keep the tests green, and note each fix in STATUS.md with before and after screenshots.

## 2026-11-01 21:15 UK: overlap bug on big screens, and responsiveness (from Allie's husband's playtest)
4. **Machines can be placed overlapping another machine (bug, high priority).** It happened on a much bigger screen than Allie's. The likely cause is that pointer-to-tile conversion or the occupied-tile check goes wrong at large canvas sizes, a high devicePixelRatio, or certain zoom levels, so the ghost and the real footprint disagree. Fix it at the source:
   - The simulation must reject any placement whose footprint touches an occupied tile, however the UI calls it. Add a unit test for multi-tile footprints next to existing buildings.
   - Pointer-to-tile conversion must use the camera's world point (accounting for zoom, scroll, canvas scale and DPR), and the ghost must snap to the same tile the sim will use.
   - Test with Playwright at 1920x1080, 2560x1440 and 3840x2160, at DPR 1 and 2.
5. **Responsiveness across screen sizes.** The game has to look and work right from 1024x640 up to 4K. That means the garden fits and is centered, the side cards don't cover the plot, the UI scales sensibly (not tiny on 4K, not crammed at 1024), and the canvas stays sharp at DPR 2. Take screenshots at 1024x640, 1280x800, 1920x1080 and 2560x1440 into producer/shots/. This also covers the earlier note about the side cards covering the plot edge at 1024 wide after Fit.
Order after the plot outline: belts (1), overlap (4), placement size (2), sound (3), responsiveness (5).

## 2026-11-01 21:30 UK: producer review of run5 (read all of this, plus the 21:12, 21:13 and 21:15 notes above, which you haven't done yet)
Pushed through 188aa8f. The Sugar Belt port and the save migration look good. But run5 finished before it read the 21:12 Northgard note, so the plot is still wrong for Allie:
- Shots 14 to 17 show a stair-stepped, rectangular outline (straight hedge runs with right-angle notches). Allie wants a smooth, organic Northgard-style border. Keep gameplay on the tile mask, but draw the border as a smoothed curve traced around the buildable tiles (for example marching squares on the mask, then Chaikin or Catmull-Rom smoothing, plus a little seeded wobble so it looks hand-drawn). Draw one continuous soft border line with the hedge following that curve, and fade the ground outside it softly instead of a hard rectangle. Make the mask itself less boxy too: lumpy bulges and inlets of different sizes rather than a few rectangles. Expansions should grow the shape along the same kind of curve.
- The "Open Plot / This costs..." label in shot 14 is clipped and overlaps the hedge. Make sure the label fits, sits fully inside the closed area, and isn't cut off.
- Q9 and Q10 are answered in ANSWERS.md (new expansion line).
Then do the 21:13 and 21:15 items in this order: belts (1), overlap on big screens (4), placement size (2), sound controls (3), responsiveness 1024x640 to 4K (5). Commit after each one, screenshot each into producer/shots/, keep tests green, update STATUS.md.

## 21:48 UK: run6 stalled
Run6 stopped producing output at 21:34 mid-thought (outline.ts and outline.test.ts written but uncommitted). Stopped it and resumed as run7 with the same instructions.
