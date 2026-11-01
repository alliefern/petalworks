# Questions from Claude

Each has the default I am building with. None blocks progress.

1. **Removal policy conflict.** `docs/design/BALANCE.md` models "deletion is blocked while a structure holds an item"; `docs/design/SLICE_ARCHITECTURE_RISKS.md` asks for a basket. **Default: basket.** Items in a removed structure go to a visible basket in the build palette and can be dropped back on any empty belt. Friendlier when a line is stuck, and nothing is ever lost. Say the word and I'll switch to blocking.

2. **Celebration pause length.** BALANCE.md says the completion toast pauses the factory "until the next order starts". **Default: a 3.2-second non-modal card during which the sim holds, then play resumes** (no click required, so no modal interruption). Order 6 opens the ending dialog, which holds until "Keep Building".

3. **Speed buttons.** The copy has Normal/Fast; the acceptance plan mentions a "very fast" speed. **Default: 1×, 2×, 3× buttons; F cycles them.** Easy to drop to two.

4. **Sandbox.** Infinite orders are out of scope. **Default: open market** (delivered goods sell for 2/3/8/12/30 coins). Alternative: repeat the six orders with bigger counts.

5. **Packing Station position.** It is pre-placed at tile (14, 7) counting from 1, on the east side of the 16×12 plot. Fine, or should it sit elsewhere (e.g. bottom centre)?

6. **Number keys.** The accessibility doc says leave the number row free for now. The old 1/2/3 speed shortcuts are gone; speeds are buttons + F. Confirm that's the intent.
