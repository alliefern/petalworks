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
