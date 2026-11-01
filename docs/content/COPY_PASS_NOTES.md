# Copy pass notes

Checked with `python3 docs/content/check_copy.py` against `main`.

Result: PASS. `copy.json` parses. 489 key paths, in the same order as `main`. 385 leaves. Counts, ids, nulls, and the `unlocks` arrays are unchanged. Each string kept its `{token}` placeholders. No em dashes, en dashes, curly quotes, unicode ellipses, or non-breaking spaces in `copy.json` or `COPY.md`. String values have no banned words from the two style guides, and no British spellings.

## For a person to decide

Coin prices are not written out in these strings. They use `{coins}` and `{cost}`, which is what COPY.md already requires. `docs/design/BALANCE.md` is not in the repo, so the 1 Nov figures could not be checked against that file. Those figures are 120 starting coins, Daisy Bed 20, Belt 2, Bundling Table 40, Lavender Bed 40, Drying Bench 60, Arrangement Table 80, order rewards 50, 70, 100, 80, 110, and 140, and expansion 100. The sim in `src/sim/data` was left alone and currently uses other coin figures: 60 starting coins, Belt 2, Daisy Bed 20, Lavender Bed 30, Bundling Table 30, Drying Bench 40, Arrangement Table 60, Packing Station 15, rewards 30, 45, 80, 60, 100, and 160, expansion 40. Someone needs to reconcile the sim with the 1 Nov figures before these strings are wired in. This pass did not type either set of prices into the copy.

Order counts in the sentences were already right, and they were left as they are: 2 daisies, 2 daisy bundles, 4 daisy bundles, 2 lavender, 2 lavender sachets, 1 mixed bouquet. Recipe lines match the sim recipes: 2 daisies to 1 bundle, 2 lavender to 1 sachet, and 1 bundle plus 1 sachet to 1 bouquet.

When a building is added: the copy says the next building arrives when that order packs. Bundling Table after Nell, Lavender Bed after Hester, Drying Bench after Ivo, Arrangement Table after Pia. The sim adds tools when the next order starts, and the list is different. This pass left the copy schedule as it was.

The sim also has older customer names and notes. `copy.json` is the player-facing text. `src/` was not edited.

Recipe lines used to use a right arrow. They now say "to", so the line can be read out loud. Put the arrow back if the inspector was drawn around that glyph.
