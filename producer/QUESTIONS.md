# Questions from Claude

Each has the default I am building with. None blocks progress. (1–6 and the number-row question were answered on Nov 1, 17:15; defaults kept.)

1. **Strings copy.json doesn't have yet** live in `EXTRA` inside `src/ui/strings.ts` (about 60 short strings: zoom/fit buttons, "Order 1 of 6", "Received 12", the open-market line, the basket/expansion error lines, the stock-full block reason, the extra keyboard rows in the controls table, the "Open Plot · This costs 100 coins." field label). Happy to move them into copy.json under the same keys when you want to edit them.

2. **Copy vs. pre-placed station.** `tutorial.opening[place-packing]` tells the player to place a Packing Station, but BALANCE.md pre-places it. **Default: that tip is skipped**; the tips card shows 7 opening tips instead of 8.

3. **Controls table.** copy.json's `controls` list has 11 rows; the build also has the accessibility doc's keys (arrows, Enter, Shift+R, X, Delete, B, P, F, = / -, Home, H). **Default: both lists are shown**, mine appended under the copy's rows.

4. **`ground_locked.png` has a painted border on every tile**, which tiles into a grid. **Default: the closed field is plain lawn under a soft moss tint with one twine outline and one "Open Plot" label**, and the locked tile art is not used. If Allie's version is seamless (no edge frame), I'll switch back by deleting a few lines.

5. **Default framing.** The game now opens on the used part of the yard (structures plus a 2-tile margin, at least 10×7 tiles, zoom capped at 1.5×). **Fit / Home** shows the whole yard. On small windows (1024 wide) the side cards still cover the yard's edge columns; the cards shrink below 1150 px and the first chain stays clear. Say if you'd rather the default be the whole yard.
