# Producer notes (from the project producer, on top of BRIEF.md)

These notes add to the brief. Where they conflict, these win.

## How this project runs
- You (Claude) are the lead developer. A producer checks in about every 20 minutes and answers questions.
- Keep `producer/STATUS.md` current. Update it after every meaningful step: what phase you're in, what works now, what you're doing next, any blockers. Write it in plain English a non-developer can read (the owner, Allie, is a designer, not a game dev).
- Put any question you need answered in `producer/QUESTIONS.md` (numbered, with your default choice). Do NOT stop and wait for answers: pick the default, note it, keep building. The producer will answer in `producer/ANSWERS.md` and may revise.
- Check `producer/ANSWERS.md` and `producer/REVISIONS.md` at the start of each phase and whenever you finish a chunk of work.
- Commit to git after every working step with clear messages. Never leave the build broken at a commit.
- Other agents may add files under `assets/art/` (illustrated sprites) and `assets/audio/`. Never delete or overwrite files there. Load art only through the manifest.

## Art pipeline (important change)
- Painterly gouache sprites will be produced by a separate art agent, not by you. Your job is to make the game look as good as possible with what exists and make art trivially swappable.
- FIRST TASK, before scaffolding much else: write `docs/ASSET_SPECS.md`. List every sprite the slice needs with: semantic key, file name, pixel size, tile footprint, facing/rotation variants, animation frames and states (growing/ready/blocked etc.), transparent background, top-down view, light from top-left, and a one-line description. Include the tile size you pick (recommend 64px tiles drawn at 2x = 128px source). Commit it right away so art can start in parallel.
- Until real art lands, use tasteful, cohesive interim art that respects the palette and is clearly flagged as interim in the manifest and KNOWN_ISSUES.md. Never claim interim art is final.

## Language
- All player-facing text uses American English spelling (color, cozy, favorite) even though the brief is written in British English. Code comments can be either.

## Checkpoints
- After Phase 1 (visual proof), save screenshots to `producer/shots/` (use Playwright headless), update STATUS.md, commit, then continue straight into Phase 2. Do not stop and wait.
- Phase 2 end = first playable milestone. Save screenshots, write `producer/PLAYTEST.md` with exact steps to run it and what to try, commit.
- Keep going through Phases 3 and 4 unless told otherwise.
