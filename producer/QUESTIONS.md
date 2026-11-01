# Questions from Claude

Each has the default I am building with. None blocks progress. (1–6 and the number-row question were answered on Nov 1, 17:15; defaults kept.)

1. **Strings copy.json doesn't have yet** live in `EXTRA` inside `src/ui/strings.ts` (about 60 short strings: zoom/fit buttons, "Order 1 of 6", "Received 12", the open-market line, the basket/expansion error lines, the stock-full block reason, the extra keyboard rows in the controls table, the "Open Plot · This costs 100 coins." field label). Happy to move them into copy.json under the same keys when you want to edit them.

2. **Copy vs. pre-placed station.** `tutorial.opening[place-packing]` tells the player to place a Packing Station, but BALANCE.md pre-places it. **Default: that tip is skipped**; the tips card shows 7 opening tips instead of 8.

3. **Controls table.** copy.json's `controls` list has 11 rows; the build also has the accessibility doc's keys (arrows, Enter, Shift+R, X, Delete, B, P, F, = / -, Home, H). **Default: both lists are shown**, mine appended under the copy's rows.

4. **`ground_locked.png` has a painted border on every tile**, which tiles into a grid. **Default: the closed field is plain lawn under a soft moss tint with one twine outline and one "Open Plot" label**, and the locked tile art is not used. If Allie's version is seamless (no edge frame), I'll switch back by deleting a few lines.

5. **Default framing.** The game now opens on the used part of the yard (structures plus a 2-tile margin, at least 10×7 tiles, zoom capped at 1.5×). **Fit / Home** shows the whole yard. On small windows (1024 wide) the side cards still cover the yard's edge columns; the cards shrink below 1150 px and the first chain stays clear. Say if you'd rather the default be the whole yard.

6. **Push rights.** `git push origin main` is rejected here (no GitHub token in the sandbox). Everything is committed locally on `main`. Options: pull from this checkout, or set `GH_TOKEN`/a credential helper for me and I'll push. Until then the Vercel build stays at the producer's last push.

7. **copy.json extra gained one key.** The title's loading bar needs "Loading the garden" (`extra.title.loadingGarden`). PR #12's test requires every leftover string to exist in copy.json, so I added that key with my placeholder text. Edit the wording as you like.

8. **1024×640 and the side cards.** Fit shows the whole yard at the 40 px floor, which is 640 px wide; the tip and order cards are 212 px each, so both cannot clear the yard in a 1024 px window (needs about 1064). The default framing keeps the used area clear, and every click in the scripted playthrough lands. **Default: leave it**, documented in KNOWN_ISSUES. Alternative if you want zero overlap there: auto-collapse the tip card to a pill below 1064 px.

9. **Expansion copy line.** `extra.palette.expandLine` said "The garden grows to 20 × 14. Permanent.", which the new shape makes untrue. I changed it (in copy.json and the fallback) to "Opens an east wing and a south corner, about 90 more tiles. Permanent." Reword as you like.

10. **Plot shape.** The starting yard and the expansion follow the tile map in `src/sim/data/plots.ts`. If Allie wants a different silhouette, it is data: edit the rectangles, and the hedge, closed field, label and tests follow. The only rule I kept is that old saves get a legacy plot covering the old box, so nothing built ever becomes invalid.
