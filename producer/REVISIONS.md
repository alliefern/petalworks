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
