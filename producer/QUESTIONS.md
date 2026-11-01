# Questions from Claude

Each has the default I am building with. None blocks progress. Answered ones can be deleted.

1. **Removal policy conflict.** `docs/design/BALANCE.md` models "deletion is blocked while a structure holds an item"; `docs/design/SLICE_ARCHITECTURE_RISKS.md` asks for a basket. **Default: basket.** Items in a removed structure go to a visible basket in the build palette and can be dropped back on any empty belt. Say the word and I'll switch to blocking.

2. **Celebration pause length.** BALANCE.md says the completion toast pauses the factory "until the next order starts". **Default: a 3.2-second non-modal card during which the sim holds, then play resumes** (no click required, so no modal interruption). Order 6 opens the ending dialog, which holds until "Keep Building".

3. **Speed buttons.** The copy has Normal/Fast; the acceptance plan mentions a "very fast" speed. **Default: 1×, Fast (2×), 3× buttons; F cycles them.** Easy to drop to two.

4. **Sandbox.** Infinite orders are out of scope. **Default: open market** (delivered goods sell for 2/3/8/12/30 coins). The panel uses `ending.sandbox` ("No further orders to pack.") plus one line of mine explaining the selling. Needs a copy line if you keep it.

5. **Packing Station position.** Pre-placed at tile (14, 7) counting from 1, on the east side of the 16×12 plot. Fine, or elsewhere?

6. **Copy vs. pre-placed station.** `tutorial.opening[place-packing]` tells the player to place a Packing Station, but BALANCE.md pre-places it. **Default: that tip is skipped**; the tips card shows 7 opening tips instead of 8. Also `palette.buildings.packingStation` is never shown in the shelf.

7. **Strings copy.json doesn't have yet** live in `EXTRA` inside `src/ui/strings.ts` (about 60 short strings: zoom/fit buttons, "Order 1 of 6", "Received 12", the open-market line, the basket/expansion error lines, stock-full block reason, the extra keyboard rows in the controls table, etc.). Happy to move them into copy.json under the same keys when you want to edit them.

8. **Controls table.** copy.json's `controls` list has 11 rows; the build also has the accessibility doc's keys (arrows, Enter, Shift+R, X, Delete, B, P, F, = / -, Home, H). **Default: both lists are shown**, mine appended under the copy's rows.

9. **`ground_locked.png` has a painted border on every tile**, which reads as a grid when tiled over the closed plot. **Default: the closed plot is drawn as plain lawn under a soft moss tint with one twine outline around the plot**, and the locked tile art is not used. If the art team can make a seamless version (no edge frame), I'll switch back by deleting three lines.

10. **Number keys.** Not bound (the accessibility doc leaves the number row free). Speeds are buttons + F.
