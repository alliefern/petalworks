# Petalworks acceptance test plan

A numbered script for a producer to run on each build before calling it the first pass. It turns the brief's acceptance criteria, controls, feedback states, save rules, softlock risks, and accessibility requirements into steps and expected results. Edge cases from playtesting risk (contested merges, occupied removal, loaded rotation, undo after an order, reload mid-transport, a corrupted save, a hidden tab, and the fastest speed) are in the script where you actually do them.

Play the game. Do not edit it to force a pass. Do not fix a save by hand except in the corrupted-save test, and only the way that test describes.

The short list for a non-developer playing the first daisy build is `playthrough-checklist.md` in this folder. This document is the one that decides whether the first pass is complete.

## Sources

Where these disagree, use them in this order:

1. `producer/REVISIONS.md` (sound set: music stays silent until the first click or key, effects and music can be silenced, and that choice survives reload)
2. `docs/PRODUCER_NOTES.md` (player-facing spelling is American English)
3. `docs/BRIEF.md` (the acceptance bar below)
4. `assets/audio/AUDIO_MANIFEST.md` (which cue plays when, once sound is in)
5. `DESIGN_DECISIONS.md` for any rule the brief leaves as a choice: refunds, what happens to items inside a structure you remove, and whether a hidden browser tab pauses the garden or catches it up

If `DESIGN_DECISIONS.md` is missing, still run the tests. A missing policy is a gap in test 59. Silent item loss is still a failure.

Starting timings, unless the design notes record a deliberate retune (write the retune down on the record card and use those numbers instead):

| Thing | At normal speed |
| --- | --- |
| Daisy bed | one daisy every 4 seconds |
| Lavender bed | one sprig every 6 seconds |
| Bundling Table | 2 daisies become 1 Daisy Bundle in 5 seconds |
| Drying Bench | 2 lavender become 1 Lavender Sachet in 7 seconds |
| Arrangement Table | 1 Daisy Bundle + 1 Lavender Sachet become 1 Mixed Bouquet in 8 seconds |

Yard at the start: an irregular garden plot of about 180 buildable tiles (it sits inside a 20 by 14 box, with bays and bulges, and a hedge along its real edge), one structure per tile. One optional expansion, Open Plot, adds about 90 more tiles along the same kind of curve after a milestone. It is not required to finish the six orders. The shape is data (`src/sim/data/plots.ts`); saves from the old 16 by 12 box keep every tile they built on.

## How to run a session

Use desktop Chrome or Edge, browser zoom at 100%, window at least 1280 by 800. A mouse with a wheel is required. Open DevTools (F12), Console tab, and turn on **Preserve log**. Keep the console visible the whole time.

Have a stopwatch and a scratch note that is not in the git repo. You will paste a save backup into that note.

**How to count flowers and goods.** Pause the game. Count sprites on belts. Add whatever the inspector shows inside each machine (inputs, in-progress craft, finished output). Add goods already credited to the current order. That is the count. After a risky step, count again.

- Shipping moves a count from the board to the order. The sum stays the same.
- Crafting replaces exact ingredients with one product (2 daisies become 1 bundle, 2 lavender become 1 sachet, 1 bundle + 1 sachet become 1 bouquet).
- Any other gain or loss is a failure.

**Pass and fail.** Each test has a **Pass**. The build fails that test when any Pass line is untrue. Severity:

- **Blocker.** Cannot finish an order the build offers, an item duplicates or vanishes, a reload changes coins or machines on its own, a softlock, an uncaught console error, or a visible control that does nothing.
- **Major.** Wrong or missing feedback, a save that drops part of the world, an accessibility miss, art that still looks like a programmer diagram, a refund or removal rule that does not match the written policy.
- **Minor.** A rough animation, a slightly off timer (outside the tolerance once), a copy nit that is still understandable.

A first pass is accepted only when every row in the traceability table at the end is Pass, or the producer has written a waiver next to a non-blocker. These cannot be waived: finishing the six orders, item conservation, a reload that matches the garden you left, no permanent softlock, and a clean console for a normal session.

**Earlier builds.** Run the whole script on a build you might accept. On an earlier milestone, mark a test "later" only when that screen has no such control yet and `KNOWN_ISSUES.md` or `producer/STATUS.md` says the feature is still to come. "Later" is not a pass. The first playable daisy milestone (orders 1 and 2, belts, bundling, packing, money, save/load) still gets tests 1 through 35 and any edge-case test whose system is already on screen.

**Finding the save.** DevTools → Application → Local Storage, and also IndexedDB, for this page's origin. Place one belt, and see which value changes. That value is the save. Copy the whole value into your scratch note before any test that says "backup".

## Record card

Fill this in as you go.

| Field | Your notes |
| --- | --- |
| Date and build (commit or label) | |
| Browser and window size | |
| Starting coins | |
| Prices: bed, belt, bundler, packing, lavender bed, drying bench, arrangement, expansion | |
| Removal rule (blocked, or returned to a basket) | |
| Refund rule | |
| Hidden-tab rule (pauses, or catches up) | |
| Speed labels and the fastest one | |
| Daisy interval at normal speed (test 29) | |
| Daisy interval at fastest speed (test 50) | |
| Daisy interval with a struggling browser (test 52) | |
| Console errors, with the test number | |
| Tests failed | |

## Score sheet

Mark Pass, Fail, or Later.

| # | Test | Result |
| --- | --- | --- |
| 1 | README commands | |
| 2 | Dev server | |
| 3 | Production build | |
| 4 | Simulation unit tests | |
| 5 | Browser smoke test | |
| 6 | New profile and Continue | |
| 7 | Silence until the first gesture | |
| 8 | First-launch art | |
| 9 | Layout | |
| 10 | No character | |
| 11 | Wording | |
| 12 | Tutorial | |
| 13 | No modal interruptions | |
| 14 | Tooltips | |
| 15 | Ghost preview | |
| 16 | Place and select | |
| 17 | Refused placement | |
| 18 | Rotate empty structures | |
| 19 | Drag belts | |
| 20 | Pan, zoom, and build mode | |
| 21 | Delete an empty structure | |
| 22 | Undo a build | |
| 23 | Cancel with right-click and Esc | |
| 24 | Autosave after building | |
| 25 | Pause and speed controls | |
| 26 | Sound, music, and settings | |
| 27 | Every visible control works | |
| 28 | Order panel | |
| 29 | Order 1, beds, belts, baseline timing | |
| 30 | Reload mid-transport | |
| 31 | Order 1 completion and undo | |
| 32 | Autosave after the order | |
| 33 | Order 2 and machine feedback | |
| 34 | Reload mid-craft | |
| 35 | Order 3 | |
| 36 | Softlock budget | |
| 37 | Periodic autosave | |
| 38 | Catalog stays locked | |
| 39 | Order 4 lavender | |
| 40 | Budget after the unlock | |
| 41 | Order 5 sachets | |
| 42 | Order 6 mixed bouquet | |
| 43 | Sandbox continuation | |
| 44 | Completed save reloads | |
| 45 | Console across the session | |
| 46 | Contested merge | |
| 47 | Simultaneous moves and head-on belts | |
| 48 | Remove structures that hold items | |
| 49 | Rotate loaded belts and machines | |
| 50 | Very fast speed | |
| 51 | Tab hidden, then shown | |
| 52 | Frame rate and processing time | |
| 53 | Grid bounds and expansion | |
| 54 | Refund policy | |
| 55 | Accessibility | |
| 56 | Broken save and schema version | |
| 57 | New Game confirmation | |
| 58 | A wasted budget can still finish order 1 | |
| 59 | Known limitations | |

---

## A. Before you play

### 1. README commands

**Checks:** the game runs locally from documented commands.

1. Open `README.md`.
2. Find the install command, the command that starts a local session, the test command, and the build command.

**Pass:**

- Those four are written down as commands a person can copy.
- You follow them in tests 2 through 5, and they are the commands that actually work.

### 2. Dev server

**Checks:** a local session boots, and the console is clean at launch.

1. Install dependencies the way the README says.
2. Start the local session the way the README says.
3. Open the page it prints. Wait until the first screen settles.
4. Read the console.

**Pass:**

- The page reaches a menu or a garden without a blank screen or an error overlay.
- The console has no uncaught exception. A documented, benign warning listed in `KNOWN_ISSUES.md` can stay. Anything else is a failure.

### 3. Production build

**Checks:** a deployable static build.

1. Stop the dev server, or use a second terminal.
2. Run the README's build command.
3. Serve the built files the way the README says (the repo script is `npm run preview` if the README agrees).
4. Open that preview URL and reach the same first screen.

**Pass:**

- The build command exits successfully and writes a static output (a `dist/` folder or the folder the README names).
- The preview URL shows the game, not a directory listing or a framework error page.
- Offline use after load is required only when a service worker is actually registered. If none is registered, note "no offline cache" and continue. If one is registered, disable the network after the first load, reload, and the game still opens.

### 4. Simulation unit tests

**Checks:** the Vitest list in the brief exists and passes. The manual tests later are still required. A green suite does not replace them.

1. Run the README's unit-test command (repo script: `npm test`).
2. Skim the test names. Open the sim test files if the names are opaque, and search them.

**Pass:**

- The command exits successfully.
- The suite includes cases you can point to for each of these: recipe consumption, blocked outputs, full buffers, simultaneous belt moves, contested destinations, rotation, building removal, insufficient funds, order allocation, unlocks, saving, and restoration.
- A missing name is a failure of this test even when the matching manual test later passes.

### 5. Browser smoke test

**Checks:** a Playwright smoke test, including a clean save and a completed save, when Playwright is part of the repo.

1. Run the README's browser-test command (repo script: `npm run test:e2e`).
2. If browsers are missing, follow the README's install step for them and run once more.

**Pass:**

- The command exits successfully, and the test list covers a fresh profile and a finished profile.
- If the repo has no browser test yet, `KNOWN_ISSUES.md` says so. That is "later", not a pass, on a build you might accept as the first pass.

---

## B. Open a new game

### 6. New profile and Continue

**Checks:** New Game, and Continue only when a save exists.

1. With the preview or dev page open, delete the site's local storage and IndexedDB (Application panel → the origin → Clear, or delete the entries you see).
2. Reload.

**Pass:**

- Continue is absent or disabled. There is a New Game (or a single start action that begins a new game).
- Starting it shows order 1, a finite coin total, and an empty buildable garden.
- Write the coin total on the record card. You will compare every later reward and purchase to it.

### 7. Silence until the first gesture

**Checks:** browser audio unlock, and music staying off until the player has clicked or pressed a key.

1. Reload once more, and do not click or press a key for a few seconds. Listen.
2. Then click the page or press a key.

**Pass:**

- The page is silent before that first gesture. No music, no ambience, no error sound on its own.
- After the gesture, music may start if the music control is on. It does not start at a startling volume.
- If this build has no audio yet and `KNOWN_ISSUES.md` says so, mark the listening tests Later and keep going.

### 8. First-launch art

**Checks:** the game looks intentionally illustrated and cohesive, not like an engineering prototype.

1. Look at the first screen for a full ten seconds before you build anything. Try it at about 1280×800 and again near 1600×1000.
2. Glance at `KNOWN_ISSUES.md` for an interim-art note.

**Pass:**

- Ground, a bed you can recognize once placed, belts, and machines share one painted garden look: warm paper-like color, a consistent light, flowers that will read against grass and against belts.
- You can tell a bed, a belt, and a machine apart by shape.
- Interim art is allowed when the issues list says it is interim and the scene is still cohesive.
- Plain rectangles, emoji flowers, unstyled default form controls, or a debug grid presented as the real look is a failure.

### 9. Layout

**Checks:** desktop HUD. The garden stays the point of the screen.

1. Name each region out loud: world canvas, top bar, build palette, and (once something is selected) an inspector.

**Pass:**

- The top bar is compact and shows coins, the current order, pause or speed, and settings.
- The build palette sits on the left or the bottom and can be collapsed and opened again.
- Panels do not permanently cover the tiles you need to click at either window size above.
- A phone-sized window is out of scope. Overlap there is a note, not a failure. Overlap at 1280×800 is a failure.

### 10. No character

**Checks:** the player is the operator. There is no avatar.

1. Click the garden. Press the arrow keys and WASD.

**Pass:**

- No character walks, no dialogue starts, and no pathfinding preview appears.
- If WASD or the arrows pan the camera, that is fine, as long as it is consistent and a visible control is not lying about it. The camera may also ignore those keys.

### 11. Wording

**Checks:** player-facing American English.

1. Read the menu, the order, the tutorial, tooltips, settings, and every button label currently on screen. Keep doing this as new text appears in later tests.

**Pass:**

- Spelling on screen uses American forms: color, cozy, favorite. Labels you can check now read naturally in that spelling.
- The British spellings in the brief (colour, cosy) do not appear in the game UI.

### 12. Tutorial

**Checks:** a short interactive tutorial, skippable, and reopenable.

1. On this fresh game, follow the first tutorial prompt if one appears. Place whatever it asks, as long as it matches order 1 (a daisy bed aimed at packing, not a bundler sitting in the way).
2. Skip the rest.
3. Find the control that opens the tutorial again. Open it. Close it without finishing.

**Pass:**

- A fresh game offers contextual prompts that tell you the next physical step.
- Skip dismisses them and leaves the garden fully playable.
- A visible Help or tutorial control opens them again.
- If no tutorial exists yet, it is Later only with a written note in `KNOWN_ISSUES.md`. On an accepted first pass it is a failure.

### 13. No modal interruptions

**Checks:** routine play is not stopped by dialogs.

1. Let the clock run with the tutorial dismissed. Watch the garden for half a minute. Do not open settings or New Game.

**Pass:**

- No dialog covers the garden and demands an OK click while you are only watching or building.
- A small unobtrusive prompt in a corner is fine.
- Confirmation dialogs that appear only after you choose New Game are tested in test 57, and they belong there.

---

## C. Controls, on a tiny layout

Order 1 asks for 2 raw daisies. Keep the bundler out of this path until test 33. A bundler between the bed and the packing station would turn daisies into bundles, and order 1 would correctly refuse to advance.

Suggested first layout, all facing east, with one grass gap you will close in test 29:

```
[Daisy Bed →][Belt →][Belt →][empty grass][Packing]
```

### 14. Tooltips

**Checks:** hover shows cost and purpose.

1. Hover each item in the build palette. Leave the pointer still on one of them.

**Pass:**

- Each available item shows a short purpose and a coin cost before you place it.
- The tooltip stays put while the pointer is still. It is readable against the garden.
- Locked items are covered in test 38. They are omitted here if they are hidden, which is what we want.

### 15. Ghost preview

**Checks:** ghost, validity, and cost before confirmation.

1. Select the Daisy Bed tool. Move the pointer across empty grass, then across the hedge or any tile outside the buildable grid, then across a tile you will occupy in a moment.
2. Do not click yet. Watch the ghost and the coin display.

**Pass:**

- A ghost of the bed follows the pointer.
- Empty buildable tiles read as valid. Tiles outside the grid, and tiles that cannot hold a structure, read as invalid, by shape or pattern as well as by color (a ring, a cross, a word).
- The cost is visible while the ghost is up, before any click spends coins.
- Coins have not changed yet.

### 16. Place and select

**Checks:** left-click places, left-click selects, and the inspector shows the working state.

1. Left-click a valid tile to place the Daisy Bed.
2. Press Escape or right-click so the tool is no longer armed (test 23 covers cancel in full; do the minimum here so the next click is a selection).
3. Left-click the bed.
4. Left-click empty grass.
5. Arm the belt tool and left-click the bed tile, as if you meant to build on top of it.

**Pass:**

- The bed appears once. Coins drop by the tooltip price exactly once. Write the price on the record card.
- With the tool disarmed, clicking the bed selects it. The inspector shows what it is, which way it outputs, growth progress, and whether it is growing, ready, or blocked. A bed has no multi-ingredient recipe; "produces daisies" is enough recipe text.
- Clicking empty grass clears the selection or leaves the garden unchanged. It does not place a second hidden bed.
- Clicking the occupied tile with the belt tool armed does not overwrite or delete the bed. You get invalid-placement feedback, or the click selects the bed. The bed is still there, still one, and coins do not drop for a belt you cannot see.

### 17. Refused placement

**Checks:** incorrect placement feedback. Insufficient funds is finished in test 58 if you cannot go broke yet.

1. With the belt tool armed, click the bed's tile again if you have not already, then click a tile outside the buildable area, then click the hedge.
2. If any palette item costs more than your current coins, select it and click a valid tile.
3. If everything is still affordable, write "insufficient funds deferred to test 58" on the record card and do not spend the garden into a hole.

**Pass:**

- Each illegal click leaves the grid unchanged and coins unchanged.
- Feedback is obvious in the moment: invalid ghost, a short message in plain language, a sound cue if sound is on (`ui_error`: a dull wooden tap, not a buzzer). The reason is specific enough to act on (occupied, outside the garden, or not enough coins).
- The message does not sit forever on top of the board.

### 18. Rotate empty structures

**Checks:** R rotates before placement and after placement.

1. Arm the belt tool. Press R four times while the ghost is showing, watching the direction mark.
2. Place a belt on a valid tile, aimed east. Select it. Press R four times.
3. Use the on-screen rotate control as well, if one is visible, on a second empty belt.

**Pass:**

- Each press turns the facing one quarter turn. Four presses restore the original facing.
- The ghost rotates before you commit, and the placed belt rotates after you commit.
- The on-screen rotate control and the R key do the same thing.
- You hear `build_rotate` once per rotation if sound is on, not a pile of overlapping copies from a single press.
- Coins do not change when you rotate.

### 19. Drag belts

**Checks:** drag lays a line of belts.

1. Arm the belt tool. Press on an empty tile and drag across three more empty tiles. Release.
2. Start another drag that runs across the Daisy Bed and then back onto empty grass.
3. Start a drag you could not fully afford, if your coins are already that low. Otherwise skip the affordability drag until test 58.

**Pass:**

- The first drag creates a connected run of belts, one per tile, each charging its tooltip price once. You hear `build_place` for the tiles that appear.
- The drag that crosses the bed does not replace the bed. Empty tiles in that drag either gain a belt or stay empty, and you are charged only for belts that actually appear.
- An unaffordable drag never pushes coins below zero and never leaves a belt you did not pay for.
- Direction stays consistent along the drag, including a corner if you turned. The corner is a belt tile that turns the flow, not a jump.

### 20. Pan, zoom, and build mode

**Checks:** wheel zoom centered near the pointer, pan on empty ground, pan with the middle mouse, and no fight with building.

1. Disarm tools (Esc). Put the pointer on the Daisy Bed, at the edge of the view if you can. Scroll the wheel in several notches, then out, until it stops in each direction.
2. Press on empty grass and drag. That should pan.
3. Arm the belt tool. Drag from empty tile to empty tile. That should lay belts, not pan.
4. With the belt tool still armed, middle-click (wheel click) and drag across empty grass.
5. Scroll the wheel while the pointer is over the garden and while it is over the page margin, if any margin exists.

**Pass:**

- Zooming in keeps the bed near the pointer. Zooming does not leap toward the center of the garden and leave the bed.
- Zoom stops at a nearest and a farthest limit. At the farthest, you can still reach every buildable tile by panning. At the nearest, tiles are easy to hit. At the game's default zoom, you can lay a straight run of belts without missing because the tiles are tiny.
- Dragging empty ground with no tool armed pans the camera and places nothing.
- Dragging with the belt tool places belts and does not also pan.
- Middle-mouse drag pans even while the belt tool is armed, and it does not place a belt under the pointer.
- The browser page behind the canvas does not scroll.

### 21. Delete an empty structure

**Checks:** the delete tool removes empty structures. Right-click is not delete.

1. Note your coins. Select the delete tool (a trowel or a clearly named remove control).
2. Click an empty belt you added in test 19.
3. Right-click a different empty belt.

**Pass:**

- The clicked empty belt is gone and the tile can be built on again.
- Coins change by the refund you will check in test 54. Write the before and after amounts on the record card. They do not go negative, and they do not rise by more than the structure's price.
- Right-click does not remove the other belt.
- `build_remove` plays once if sound is on.
- The Delete or Backspace key removes a structure only if the UI shows that shortcut. If the key does nothing and the UI never mentions it, that is fine.

### 22. Undo a build

**Checks:** Z undoes a recent build when it is safe, and undo cannot mint coins.

1. Note coins. Place one belt. Press Z, or the undo button if it is visible.
2. Place one belt and remove it with the delete tool. Press Z.
3. Repeat place-then-undo three times on the same tile. Compare coins to the number you wrote at the start of this step.
4. Press Z a few more times when you believe nothing build-related is left to undo.

**Pass:**

- The placed belt disappears on undo, and the coins return to the pre-place total.
- Undo after a delete restores that empty belt, and coins return to the pre-delete total. One belt, not two.
- Three place/undo cycles leave coins unchanged from the start of the cycles.
- Extra undos do nothing harmful: no error overlay, no negative coins, no phantom structure. A small "nothing to undo" message is fine. `undo` plays only when a build actually rewinds.
- Order progress has not appeared. You have not shipped anything.

### 23. Cancel with right-click and Esc

**Checks:** both cancels disarm a tool without placing.

1. Arm the Daisy Bed. Move the ghost over a valid empty tile. Right-click.
2. Arm the Daisy Bed again. Press Esc.
3. Open settings if you already can, then press Esc.

**Pass:**

- After right-click, the ghost is gone and a further left-click on grass does not place a bed. Coins unchanged.
- Esc does the same for the armed tool.
- Esc closes settings if they were open, and does not place a structure while doing it.
- If both a tool and a panel are open, Esc closes the panel first or disarms the tool, and one more Esc clears the other. You are never stuck inside a panel.

### 24. Autosave after building

**Checks:** a meaningful build is saved immediately. This is the clean-save check.

1. Make sure the Daisy Bed is on the board and the tutorial is skipped. Rotate the bed so its output faces east. Note coins and the order name.
2. Reload the page immediately (F5), within a second of the last edit.

**Pass:**

- The garden returns with that bed, facing east, on the same tile. Coins and order 1 match what you noted.
- The bed is not duplicated.
- The tutorial does not seize the screen again. Continue is available if a menu appears; otherwise you land directly in this same garden. A menu that ignores the save and starts you empty, with no warning, is a failure.
- You did not have to press a Save button. There is no separate save action required.

### 25. Pause and speed controls

**Checks:** pause freezes the simulation, every speed control works, and you can return to normal speed. The stress test at the fastest speed is test 50.

1. Unpause if needed. Watch the bed's progress move.
2. Pause. Wait five seconds. Watch progress, belts, and any moving flower.
3. Unpause. Progress advances again.
4. Click every speed the HUD offers, including the fastest. Time one daisy cycle if a flower is already producing (or come back to the timing once the bed is running in test 29). Return to the speed labeled normal, 1×, or the default.

**Pass:**

- While paused, growth does not advance, belt items do not travel, and new flowers do not appear. `belt_tick` and `machine_working` are silent while paused. Music, if it was playing, fades down rather than continuing at full level, and it returns when you unpause.
- Each speed control visibly changes how fast growth moves. None of them are decorative.
- The fastest speed does not throw a console error on this short try. Leave the thorough conservation check to test 50.
- You can get back to normal speed. Later stopwatch tests are worthless if you leave the game on fast. Confirm the label before test 29.

### 26. Sound, music, and settings

**Checks:** sound and music toggles, a persisting mute, and the cue list. Keep ticking the cue table through test 43, then score this test.

1. Open settings. Flip every audio control. Confirm you can silence effects and music separately if both toggles exist, or that a single mute silences both.
2. Set both silent. Reload.
3. Set them audible again if you want the cue table. Set music on after your first click.

Cue table (tick when you have heard it once under the right condition):

| Cue | Where it should happen |
| --- | --- |
| `ui_click` | Activating a button, palette item, or menu row |
| `ui_hover` | Pointer entering a button or palette item, once, not a retrigger storm |
| `ui_error` | A refused placement or a purchase you cannot afford |
| `build_place` | Each real placement, including each tile of a belt drag |
| `build_rotate` | R or the rotate control |
| `build_remove` | Delete tool removes an empty structure |
| `undo` | A build actually undoes |
| `belt_tick` | While a flower rides a belt; stops while paused; does not stack copies |
| `flower_bloom` | A bed becomes ready |
| `machine_working` | While a machine crafts; one shared loop however many machines are busy; stops while paused |
| `blocked` | The moment a bed or machine becomes blocked; not again on every tick while it stays blocked |
| `item_pop` | A bundle, sachet, or bouquet pops out |
| `deliver` | Packing accepts an item; once, even if several arrive together |
| `order_complete` | Orders 1 through 5 complete |
| `coins` | A refund. On an order payout it stays quiet or slightly delayed, and does not drown the chime |
| `unlock` | A new bed, machine, or recipe becomes available |
| `final_celebration` | Order 6, in place of `order_complete` |
| `music` | After the first gesture, from play through the sandbox; separate from effects; fades while paused |

**Pass:**

- After the silent reload, effects and music are still off. The choice lives in the save.
- Turning them back on works without a second reload.
- By the end of test 43, every row you could have reached in this build has been heard under the condition in the table. A cue that plays on a loop stacked on itself, or a celebration that plays the order-5 chime and the final celebration together, is a failure.
- Settings that are visible and not audio (a future reduced-motion toggle) are exercised in test 55. They must not be dead buttons. That is also part of test 27.

### 27. Every visible control works

**Checks:** no fake buttons. Every visible control does the thing it presents.

1. Collapse and expand the palette.
2. Open and close settings.
3. Press every button, tab, and icon on screen once, including anything you have not used yet. Skip New Game until test 57 so you do not wipe the garden. Skip expansion if you are not ready to buy it; hover it and confirm it either explains the price and milestone or is not shown yet.
4. If a control looks disabled, it needs a reason you can see (locked, unaffordable, nothing to undo), not a silent click.

**Pass:**

- Every control either does its job or clearly explains why it will not.
- No control looks pressable and then does nothing: no dead settings row, no belt tool that never places, no pause that does not pause.
- You are not looking at a button for multiplayer, ads, login, cloud save, a character, or any other out-of-scope feature.

---

## D. Ship the six orders

This stretch is the 20-minute session. Stay on normal speed. Keep the console open. Do not use developer shortcuts, console commands, or save editing.

### 28. Order panel

**Checks:** the current order shows requirement, progress, and reward in words.

1. Read the order strip or panel before anything is shipped.

**Pass:**

- It says you need 2 daisies, shows progress at none of them, and shows a coin reward.
- The words "daisy" or "daisies" are on screen. A tiny flower picture is allowed beside the words. A picture with no words is a failure (test 55 covers this properly).
- The reward number is readable. Write it down.

### 29. Order 1, beds, belts, baseline timing

**Checks:** real production and shipping, bed states, belt rules, gap behavior, baseline processing time, and that packing does not invent deliveries.

1. Build, facing east:

```
[Daisy Bed →][Belt →][Belt →][empty grass][Packing]
```

   If your coins cannot pay for this, stop. That is a softlock and a blocker (the brief requires a daisy chain to be affordable before you depend on rewards). Include the bundler's price in that judgment if the bundler is already in the palette: starting coins must cover 1 Daisy Bed, 1 Bundling Table, 1 Packing Station, and about 6 belts. Write the sum on the record card.
2. Watch the bed. Note the time from "just produced or just placed and empty" to the next ready daisy. Do this at normal speed. Write the seconds on the record card.
3. Watch the first daisy travel. It should glide from the center of a tile to the center of the next.
4. Leave the grass gap in place until the daisy reaches the last belt.
5. Then fill the gap with a belt and let the daisy reach packing.
6. Watch a second daisy. While you wait, block the packing input by deleting the last belt after one daisy has shipped, so the next daisy has nowhere to go. Watch the bed. Reconnect after you have seen the blocked state.
7. Confirm the order number while a daisy is sitting on a belt and has not entered packing.

**Pass:**

- The bed shows three distinguishable states: growing, ready, and blocked. Blocked uses a symbol, badge, or word, not a recolor alone. When blocked, the bed does not grow a second daisy on top of the one that cannot leave.
- A daisy appears about every 4 seconds of wall-clock time at normal speed (allow about half a second either way).
- The daisy moves one tile at a time along the belt direction, visually from tile center to tile center. It turns if you later add a corner. It does not hop across the grass gap into packing.
- With the gap in place, the daisy waits on the last belt. Packing's count and the order stay unchanged. The order moves only when a daisy actually enters packing, and it moves by one per daisy.
- Two daisies are never on the same tile. The bed's single waiting daisy plus the daisies on belts plus the order count conserves.
- `flower_bloom` plays when the bed becomes ready. `deliver` plays when packing accepts a daisy.
- You did not need a developer tool to make any of this happen.

### 30. Reload mid-transport

**Checks:** a reload while a flower is visually between two tile centers restores one flower, in a legal place.

1. Before order 1 completes, watch a daisy leave a tile center.
2. While it is clearly between two centers, reload immediately. Try twice across the next two daisies if the first reload misses the moment.
3. After the page returns, pause and count.

**Pass:**

- The garden, coins, order progress, and belt directions match the pre-reload world.
- That daisy exists once. It sits on a real tile or is animating out of a real tile. There is no twin, no leftover ghost sprite, and no missing daisy from the count.
- The console is still clean.

### 31. Order 1 completion and undo

**Checks:** celebratory feedback, a single payout, the next objective, and undo that does not rewind a completed order.

1. Reconnect the path if it is broken. Ship the second daisy.
2. The moment the order completes, write down coins, the new order title, and progress.
3. Immediately press Z and the undo button.

**Pass:**

- A clear celebration plays (visual, and `order_complete` if sound is on). The reward is added to your coins once. The new total equals the previous total plus the reward shown on the order, plus any refund you can account for, and nothing else.
- The panel now shows the next order (2 Daisy Bundles), progress empty, and its reward.
- Undo does not un-complete the order, does not pay the reward again, does not remove the reward, and does not put the shipped daisies back on the belt while the order stays complete.
- A belt you place after this, then undo, goes away. Coins and the new order stay as they were.

### 32. Autosave after the order

**Checks:** order completion is saved immediately, and the restored game matches the persistence list for everything that exists so far.

1. Without building anything else, reload at once.
2. Walk this list. Later tests add the rows that are not on screen yet (lavender, tutorial mid-step, in-progress crafts).

| Saved fact | What you should see |
| --- | --- |
| Grid occupancy | The same beds, belts, and packing, on the same tiles |
| Orientations | The bed still outputs the way you faced it |
| Buffers | Machines you own show the same contents |
| Items in transit | The same flowers on the same belts, none doubled |
| Money | The post-reward total |
| Unlocks | Bundling is available if this order was supposed to reveal it; lavender is not available yet |
| Active order | 2 Daisy Bundles, progress empty |
| Completed orders | Order 1 stays done and does not pay again |
| Tutorial state | Still skipped, or still on the step you left it |
| Settings | Sound and music match test 26 |

**Pass:**

- Every row that applies right now matches.
- Landing in the garden does not replay the celebration or add the reward a second time.

### 33. Order 2 and machine feedback

**Checks:** a Daisy Bed feeds a Bundling Table through belts, bundles travel to packing, and machine states are visible. Also wrong-item and full-buffer feedback.

1. Rebuild so daisies must pass through the bundler, for example:

```
[Daisy Bed →][Belt →][Bundling Table →][Belt →][Packing]
```

   Rotate with R so each output faces the next tile. Select the bundler.
2. When the Bundling Table's price is visible, write it on the record card. Compare it with the starting coins from test 6: those starting coins must cover 1 Daisy Bed + 1 Bundling Table + 1 Packing Station + 6 belts. Use the starting total for this sum, separate from whatever you hold after order 1.
3. Watch it with fewer than 2 daisies inside, then while it works, then when a bundle is ready to leave.
4. Time the craft at normal speed, from the second daisy entering until the bundle appears. Write it down (expect about 5 seconds).
5. Ship 2 bundles the long way, through belts into packing. Watch the order.
6. Wrong item: send a finished Daisy Bundle back toward the bundler's input (a short loop, or a belt aimed from the output side into the table). Keep that bundle out of packing so the order count stays meaningful. Watch what the table does.
7. Full buffer and blocked output: point the bundler's output at grass or a belt that is already full, and keep the bed producing until the table cannot take more. Read the inspector.

**Pass:**

- The starting-coin sum in step 2 covers the daisy bundle chain. Needing order 1's reward before that chain was ever affordable is a softlock risk and fails this test.
- The inspector, while the table is selected, shows the recipe (2 daisies → Daisy Bundle), progress, what is in the buffer, and the output direction.
- States you can tell apart: waiting for inputs, processing, ready to output, and blocked. Each has a symbol, word, or distinctive pose, not color alone.
- One daisy never becomes a bundle. Two daisies leave the buffer and one bundle appears. The 5 second craft is about 5 seconds of wall clock at normal speed.
- Bundles move on belts one per tile and increment the order only when packing receives a bundle. Raw daisies do not increment the bundle order. Packing does not gain bundles you did not watch travel in.
- The returned bundle is not eaten as a daisy. It stops, with visible refused-item feedback (a distinct badge or message). It still exists in the count.
- When the output is blocked or the input buffer is full, further daisies wait on the belt. They do not vanish, overlap, or force a second bundle out. `blocked` plays on the transition, not on every tick.
- When you clear the output, the waiting bundle leaves and work resumes.
- A small visual pop accompanies the finished bundle (`item_pop`), and the belt itself shows motion (chevron crawl or equivalent) while items ride it.
- Order 2 completes with the same celebration and single payout rules as test 31.

### 34. Reload mid-craft

**Checks:** a craft in progress survives a reload without double-consuming ingredients.

1. Start another bundle after order 2 if the next order still wants bundles (it does: order 3). Catch the bundler about halfway through the 5 seconds.
2. Note the inspector: ingredient count, progress, and whether a finished bundle is already sitting on the output.
3. Reload immediately.

**Pass:**

- The table still has those ingredients, or a single finished bundle if the tick completed as you reloaded. It does not have both the finished bundle and the ingredients.
- Progress is about where it was, or finished once. It is not reset to empty in a way that deleted the daisies, and it is not instantly done if you caught it early.
- The daisy and bundle count still conserves.

### 35. Order 3

**Checks:** throughput. Four Daisy Bundles, produced and delivered for real.

1. Read the order. It asks for 4 Daisy Bundles.
2. Let the chain run. You may add a second Daisy Bed or a cleaner belt layout if you want the order to move. Pay for it with coins you actually have.
3. Watch packing receive four bundles.

**Pass:**

- Progress goes 1, 2, 3, 4 as bundles arrive, not in a jump from nothing to done.
- You can see each bundle. The order does not complete from daisies, and it does not complete early.
- Celebration, one payout, and the next order (2 raw lavender) appear.
- The garden never required you to open the console.

### 36. Softlock budget

**Checks:** required equipment stays affordable, and unlocks you need are reachable. Update this again in test 40.

1. Write coins after order 3.
2. Add up the cost of what order 4 through order 6 still require on top of the daisy chain you already own: a Lavender Bed, a Drying Bench, an Arrangement Table, packing if you somehow sold it, and a short run of belts (about 8) to connect a second chain into the arrangement table and then to packing.
3. If those buildings are still hidden, use prices the moment they unlock (test 40). For now, confirm you are not already at zero coins with an empty garden.

**Pass:**

- You still own a working daisy-bundle chain, or you can rebuild it from coins plus the documented refund.
- Nothing in the UI asks you to pay an upkeep, a fuel cost, or a timer to keep producing. Leave the game running on purpose and confirm coins do not tick downward by themselves.
- You have a written sum ready for test 40. If that sum already exceeds your coins plus the rewards printed on orders 4 and 5, and selling the daisy chain is the only way to afford lavender, flag a blocker now. You still need the daisy chain to make a bouquet.

### 37. Periodic autosave

**Checks:** the game saves during play even when you are not building or completing an order.

1. Note belt contents and the bundler's buffer. Do not build, delete, or complete an order.
2. Wait for the interval named in `DESIGN_DECISIONS.md`. If none is named, wait two minutes.
3. Reload.

**Pass:**

- Flowers that grew or moved during the wait are in the restored garden, in legal positions, with the same conservation rules.
- You did not lose the run because you forgot to click Save.

### 38. Catalog stays locked

**Checks:** only unlocked recipes and build options are offered.

1. Before you place lavender, look through the whole palette and any recipe list in the inspector.

**Pass:**

- Lavender Bed, Drying Bench, and Arrangement Table are absent, or present in a clearly locked state that will not place and will not take coins.
- You cannot place them by clicking around the lock.
- Daisy Bundle is available. Lavender Sachet and Mixed Bouquet are not offered as things you can build yet.
- Order 4 itself is what tells you lavender is next. The unlock arrives by playing, not by a developer flag.

### 39. Order 4 lavender

**Checks:** lavender is a real production chain, unlocked by progress.

1. When order 4 is active (2 raw lavender), look at the palette again.
2. Place a Lavender Bed, face it onto a belt, and ship 2 sprigs to packing. Keep the daisy chain in place.
3. Time one lavender cycle at normal speed (about 6 seconds).

**Pass:**

- The Lavender Bed becomes available as this order begins, with an unlock moment (`unlock` if sound is on). It was not placeable in test 38.
- Sprigs grow one at a time, show growing, ready, and blocked, travel on belts, and increment the order only at packing.
- A daisy does not satisfy the lavender count. A sprig does not satisfy a later sachet count.
- The cycle is about 6 seconds. The order pays once and advances to 2 Lavender Sachets.

### 40. Budget after the unlock

**Checks:** the second chain and the bouquet machine are affordable without selling the daisy chain.

1. Write the newly revealed prices.
2. Add: Lavender Bed (if not already bought), Drying Bench, Arrangement Table, and the belts you still need.
3. Compare to coins on hand plus the printed reward of order 5 if the arrangement table is only needed for order 6.

**Pass:**

- You can buy the remaining required machines and a connecting belt path while the daisy-bundle chain stays on the board.
- If you are short, the documented refund on decorations or spare belts you do not need for the daisy chain covers the gap. Needing to sell the daisy bed, the bundler, or the only packing station to afford lavender or the arrangement table is a blocker.

### 41. Order 5 sachets

**Checks:** the drying bench consumes real lavender.

1. Place a Drying Bench between the lavender bed and packing.

```
[Lavender Bed →][Belt →][Drying Bench →][Belt →][Packing]
```

2. Confirm a sachet does not appear from a single sprig. Time the craft (about 7 seconds) once both sprigs are in.
3. Deliver 2 sachets.

**Pass:**

- The bench waits, processes, blocks, and outputs with the same clarity as the bundler.
- 2 lavender become 1 sachet. Sachets are what the order counts.
- Payout happens once. The next order is 1 Mixed Bouquet.

### 42. Order 6 mixed bouquet

**Checks:** the arrangement table takes the two different inputs from adjacent belts and outputs only on its facing side.

1. Face the Arrangement Table east into a belt that reaches packing.
2. Feed a Daisy Bundle in from the west and a Lavender Sachet in from the north (any two different adjacent sides are fine). Keep both upstream chains running.
3. Select the table and read the recipe, buffer, progress, and output facing.
4. Confirm one bundle alone, or one sachet alone, does not produce a bouquet. Time the craft once both are in (about 8 seconds).
5. Rotate the table so the output facing points at grass or a blocked tile. Let a bouquet become ready.
6. Rotate it back toward the belt and let that bouquet reach packing.

**Pass:**

- Both inputs arrive through belts from adjacent tiles. The table does not teleport them.
- The bouquet leaves only from the marked facing. While that facing is blocked, the bouquet stays with the machine, the ready state is visible, and nothing pops out of a side or into the grass.
- The recipe is exact: 1 bundle + 1 sachet → 1 bouquet. Extra flowers are not consumed as a substitute.
- Packing credits one Mixed Bouquet when that item arrives, and the order completes once.

### 43. Sandbox continuation

**Checks:** the sixth order has a completion moment and the player is not dumped at a dead end.

1. Watch the moment order 6 completes. Wait through it.
2. Try to place one more belt. Let one more daisy grow.

**Pass:**

- A distinct completion moment plays (`final_celebration` if sound is on, and not `order_complete` stacked on top of it at full strength).
- You can still see the garden, still pause, still build, and still watch goods move. Coins stay at the post-reward total.
- The game does not kick you to a blank menu, a locked "thanks for playing" wall, or an order you cannot fill.
- Further orders may stop. That is fine. The factory keeps running.

### 44. Completed save reloads

**Checks:** a finished game restores without a second payout. This is the completed-save check.

1. Note coins, one machine's facing, one buffer, the order state ("complete" or sandbox), and a flower that is on a belt.
2. Reload.

**Pass:**

- The full persistence list from test 32 still matches, now including lavender unlocks, both chains, arrangement contents, completed orders through 6, and settings.
- The completion moment does not replay, and coins do not rise by the order 6 reward again.
- The flower on the belt is still one flower.
- Coins still do not drain while the sandbox runs.

### 45. Console across the session

**Checks:** no runtime errors in a normal play session. Tests 29 through 44 are that session.

1. Scroll the preserved console from launch through the sandbox reload.

**Pass:**

- There is no uncaught exception and no error overlay during the session.
- Warnings that `KNOWN_ISSUES.md` already lists may remain. New red errors fail this test, with the test number where they appeared written on the record card.

---

## E. Edge cases on the finished garden

Stay in the sandbox save. Build extra belts off to the side so you do not have to destroy the working chains until a test tells you to. Pause before you count.

### 46. Contested merge

**Checks:** two items that want the same tile on the same tick. One enters. The other waits. Nothing is deleted or duplicated. The winner is deterministic.

1. Build a T, aimed at an empty center tile that exits east into a free belt:

```
                 [Belt ↓ with a daisy waiting]
[Belt → with a daisy waiting][empty center →][Belt →]
```

   Equal-length paths from two daisy beds are a good way to make both daisies arrive together. Use normal speed, or the slowest speed if one exists, so you can see the meeting.
2. Watch the center tile for several meetings.
3. Reload a backup of this layout, or rebuild the same lengths, and watch the first meeting again.

**Pass:**

- When both approaches hold a daisy and the center is empty, the center receives exactly one daisy. The other stays on its own tile until a later tick.
- You never see two daisies on the center tile, and neither daisy disappears.
- The same approach wins both times you run the same layout. Write down which side won.
- Downstream, daisies still travel one per tile.

### 47. Simultaneous moves and head-on belts

**Checks:** a full belt advances together, and opposing belts do not pass through each other.

1. Fill a straight eastbound run of at least four belts, one daisy on each, with an empty belt or packing in front. Unpause for one step if you can pause quickly, or watch in slow speed.
2. Then build a head-on pair of beds:

```
[Bed →][Belt →][Belt →][Belt ←][Belt ←][Bed]
```

3. Let both sides feed until the middle is crowded.

**Pass:**

- On the straight run, each daisy moves exactly one tile forward when the tile ahead is free. Four daisies are still four daisies. None share a tile, none swap backward, and none vanish.
- If the front tile is blocked, daisies stay one per tile and the beds reach the blocked state instead of shoving items into the same square.
- On the head-on layout, daisies do not cross through each other, do not overlap on the contested tile, and do not disappear. Each side backs up and the beds eventually show blocked.

### 48. Remove structures that hold items

**Checks:** the one removal policy, applied consistently. Invalid removal must not delete inventory.

Read the removal rule in `DESIGN_DECISIONS.md` and write it on the record card. The brief allows exactly one of these:

- **Block.** Removal is refused, with an explanation, while the structure holds anything.
- **Recover.** The items move into a visible inventory (a basket or similar) that you can put back into the factory.

1. Empty case, as a control: delete one empty spare belt. It goes, with the refund from test 54.
2. Belt case: trap a daisy on a belt by leaving the next tile empty or blocked. Choose the delete tool and click that belt.
3. Machine case: catch the bundler with 2 daisies inside and the craft unfinished, or with a finished bundle that has not left. Delete the bundler.
4. Packing case: if packing shows stored goods that are not yet on a completed order, delete packing. If the sandbox order is already complete and packing is empty of uncredited goods, note that and instead delete a machine that still holds a product.
5. If the rule is Recover, press undo after the machine deletion.

**Pass:**

- The empty belt follows the refund rule and is gone.
- The trapped daisy still exists. Either the belt stays and a plain-language message tells you it is not empty, or the belt is gone and that daisy is in the visible inventory, of the right type, once.
- The bundler's daisies or finished bundle follow the same rule. They are not silently deleted. A half-done craft returns its ingredients or stays in the machine because deletion was blocked. It does not turn into both a bundle and the original daisies.
- Order credit that packing already applied stays applied. Deleting packing does not pay the order again and does not zero a sandbox you already finished. Uncredited goods inside it follow the same block-or-recover rule.
- Undo after a recover does not leave you with the items in the inventory and the same items inside the restored machine.
- Both policies are not mixed: you do not get a silent delete on belts and a basket on machines, or the reverse, unless the design notes say so in one sentence and the game matches that sentence. Silent deletion with no message and no inventory is a failure either way.
- You can get a recovered daisy back onto a belt or into packing. "Recoverable" includes a way back in.

### 49. Rotate loaded belts and machines

**Checks:** rotation before or after placement, and an invalid rotate does not delete what is on the tile.

1. Trap a daisy on a straight belt. Select the belt. Press R four times, slowly.
2. Trap a daisy on a corner. Press R four times.
3. Select the bundler while it holds at least one daisy or a finished bundle. Rotate it four times with R and, if it exists, the on-screen control.
4. Spam R quickly on the loaded belt for a second.

**Pass:**

- The daisy on the straight belt exists the whole time, still one sprite. Either every press turns the belt and the daisy will leave in the new direction, or the game refuses to rotate an occupied belt, tells you why, and leaves the direction and the daisy unchanged.
- The corner behaves the same way. The daisy is not thrown onto grass and is not duplicated.
- The bundler's buffer and any finished output stay in the inspector through the rotations. Output facing updates only if rotation is allowed. Ingredients are not cleared.
- Rapid presses leave one daisy and a facing that matches a whole number of quarter turns. No console error.

### 50. Very fast speed

**Checks:** the fastest speed setting still conserves items, still enforces recipes, and still pauses.

1. Set the fastest speed the HUD offers. Confirm the label on the record card.
2. Time one daisy cycle. Write it down.
3. Let both chains run into their machines for a short stretch, including a merge if you still have the T from test 46.
4. Watch a bundler accept daisies.
5. Pause while the fastest speed is still selected. Wait three seconds. Unpause. Return to normal speed.

**Pass:**

- The daisy cycle is clearly shorter than the 4 second baseline, in proportion to the label if the label is a multiplier (2× is about 2 seconds, allow a little slack). If the label has no number, two cycles at this speed agree with each other, so the rate is stable.
- One item per tile still holds. Recipes still take their full ingredients: a bundle still costs 2 daisies, a bouquet still costs both inputs. The order does not complete from thin air.
- Pause freezes the fast simulation completely.
- The console stays clean. Normal speed afterward matches the old baseline again.

### 51. Tab hidden, then shown

**Checks:** leaving the browser tab and coming back.

1. At normal speed, note the count and the bed progress. Note the time.
2. Switch to a different browser tab for 30 seconds. Do not close the game tab.
3. Come back. Pause and count. Read the console.

**Pass:**

- The garden is on screen. No spinner stuck forever, no blank canvas, no error overlay.
- The hidden-tab rule is either "the garden paused" or "the garden caught up in fixed steps". Both are acceptable. Write which one you saw.
- If it paused, the count matches what you left (a flower already due may finish that one step).
- If it caught up, new flowers sit in legal places only: one per belt tile, inside buffers, or credited to packing. One daisy bed produces a handful of daisies in 30 seconds (around seven), not a pile of dozens stacked on one tile.
- Nothing has duplicated, vanished, or overlapped. Order progress has not gone backward.

### 52. Frame rate and processing time

**Checks:** processing time does not depend on the browser's frame rate.

1. Confirm you are on normal speed and that the record card has the test 29 daisy interval.
2. Open DevTools → more tools → Rendering, or the Performance panel, and set CPU throttling to 6× slowdown (Chrome: Performance panel → gear → CPU). Leave it on.
3. Time one daisy cycle with the stopwatch, in wall-clock seconds. Time a bundle craft if a bundler is running.
4. Turn throttling off.

**Pass:**

- The daisy interval stays near the test 29 number (within about a quarter of that number). It does not stretch out toward 24 seconds, and it does not collapse into "one daisy every frame".
- The bundle craft stays near 5 seconds of wall clock under the same throttle.
- Turning the throttle off returns the game to the baseline. The console gained no errors from the slow frames.
- Flowers still move tile to tile without overlapping while the browser is struggling.

### 53. Grid bounds and expansion

**Checks:** the irregular starting plot (about 180 tiles inside a 20×14 box), and the optional one-time Open Plot expansion (about 90 more tiles), without letting expansion trap you.

1. Follow the hedge around the yard. Try to place just outside it on each side, in a bay (an inlet of linen between two hedge runs), and on the closed field beyond the hedge if one is showing.
2. If an expansion control exists, read its price and whether it is available in the sandbox. You should already have finished all six orders without it. If you have not bought it, decide from the price whether buying it now would have been a problem back in test 40.
3. Buy it once if you can afford it without going broke. Try to buy it again. Count the new buildable size.
4. Try to place on a still-locked plot if any remain.

**Pass:**

- The buildable area is exactly the lawn inside the hedge: an irregular shape of about 180 tiles, not a rectangle. Clicks outside the hedge, including in a bay, are refused with the same kind of feedback as test 17 ("That spot is outside the garden."), and clicks on the closed field say the plot is still closed.
- All six orders were finishable without the expansion. If the expansion was offered earlier, its price was not the thing that made the bouquet chain unaffordable, or it was clearly optional and you could ignore it.
- After you buy it, the hedge moves out to the new curve and about 90 more tiles are buildable (the Open Plot label said about 90 and the price); coins drop by the shown price once; nothing you built moved; a second purchase is not offered or is refused.
- The closed field, while it is closed, rejects placement and looks distinct from buildable grass (a tinted lawn with a dotted twine outline and one Open Plot label, no tile grid showing), and the ground beyond the hedge fades into the linen along a smooth curve with no square steps.

### 54. Refund policy

**Checks:** selling or removing empty structures follows one documented rule.

1. Read the refund section of `DESIGN_DECISIONS.md`. Write the rule on the record card (full price, partial, or none, and whether refunds differ by building).
2. Place one empty belt and delete it. Place one empty spare bed, if you can afford it, and delete it. Undo once and delete again.
3. Compare each coin delta to the rule.

**Pass:**

- The design notes state the rule in plain language.
- Every empty deletion in this session, including test 21, matches that rule. The same building refunds the same amount every time.
- Coins never go negative, and undo reverses the refund exactly.
- There is no per-minute upkeep hiding in the coin total.

### 55. Accessibility

**Checks:** readable text, contrast, keyboard menus, visible focus, status that is not color alone, configurable sound, reduced motion, large targets, and words beside icons.

1. At default camera zoom, place a short belt run on purpose and notice whether the tiles are a comfortable mouse target.
2. Read coins, the order, a tooltip, and a blocked-machine inspector from a normal sitting distance. Squint. The text should still be readable, and the panel behind it should be clearly lighter or darker than the letters.
3. Click the garden, then press Tab until you have visited pause, settings, and a palette control. Press Shift+Tab. Press Enter or Space on pause. Open settings with the keyboard if a focused control does that, then press Esc.
4. Look at a blocked bed, a waiting machine, and a ready output. Imagine the screen in grayscale.
5. Turn on reduced motion. Prefer an in-game control if one exists. Also emulate the OS preference: DevTools → More tools → Rendering → **Emulate CSS media feature prefers-reduced-motion** → **reduce**. Watch belts, a finished-product pop, and, if you can trigger a small one, a celebration. Then turn emulation off and set the in-game control back to full motion so you leave the build the way you found it.
6. Confirm sound can still be turned off from settings (test 26) and that the blocked state is still understandable with sound off.

**Pass:**

- Default zoom tiles are large enough that a careful drag does not miss because the squares are tiny. About a fingertip on screen is the idea. The 64px tile size in the art spec is the intended target.
- Coins, orders, and inspector text are real words at a readable size, with contrast you do not have to work for. Order requirements are words, not only a pictogram.
- Tab reaches the menus. The focused control shows a visible ring or bar. Enter or Space activates it. Shift+Tab moves backward. Esc leaves settings. Focus is not trapped in the canvas. If a modal is open, Tab stays inside it until Esc closes it.
- Blocked, waiting, and ready are distinguishable by shape, icon, word, or pose when color is ignored.
- With reduced motion, decorative crawl, sparkles, and the big celebration calm down or stop. Flowers still move in a way you can follow, tile to tile. The game remains playable. The OS emulation and the in-game toggle, if both exist, both do this. A missing in-game toggle is acceptable when the OS preference is honored. Ignoring both is a failure.
- Sound off leaves the garden understandable. Status does not depend on hearing `blocked`.

---

## F. Destruction tests, last

Back up the save into your scratch note before test 56. These tests are allowed to wipe the live garden.

### 56. Broken save and schema version

**Checks:** a schema version exists, and a corrupted save cannot take the game down.

1. Confirm the backup in your scratch note is the finished garden (coins and a machine you recognize).
2. In DevTools, open the save value. Find a version or schema field. Write the number down.
3. Replace the entire value with `{` and reload.
4. Put the backup back into the same key (recreate the key if the game removed it). Reload. Confirm the finished garden returned. If it did not, stop and fail this test before continuing.
5. Set only the version field to 9999. Reload.
6. Restore the backup again and confirm the garden returned.
7. Delete the grid or the money from an otherwise valid JSON value, so it still parses. Reload.
8. Restore the backup one last time.

**Pass:**

- A schema version is stored in the save. You found the field in step 2. No version field is a failure.
- After each of the three bad values (broken JSON, future version, missing grid or money), the page loads. You see a plain-language explanation and a way into New Game, or the game discards the bad save and offers a fresh start. You do not see a half-built garden, a coin total of NaN, a blank canvas, or a console that is filling with the same error over and over.
- Restoring the backup brings the finished garden back, unchanged, each time you do it before starting a replacement game. The recovery path does not make a good backup unrestorable.
- The explanation would make sense to a designer who does not know what JSON is.

### 57. New Game confirmation

**Checks:** New Game asks, cancel keeps the world, confirm starts over.

1. With the restored finished garden on screen, note a distinctive belt and the coin total.
2. Choose New Game. Read the dialog. Choose cancel, or the equivalent "keep playing".
3. Check the belt and the coins. Reload.
4. Choose New Game again. Confirm.

**Pass:**

- The first choice shows a confirmation that says, in plain language, that the current garden will be cleared.
- Cancel leaves the distinctive belt, the coins, the orders, and the unlocks untouched, including after the reload.
- Confirm starts order 1 on an empty buildable grid, with the original starting coins, the locked catalog, and the tutorial offered again.
- A reload after confirm shows that new game, not the finished garden.
- Settings may either reset or stay. Whichever happens, it happens cleanly, with no error. Record which one you saw.
- Continue now refers to this new game, once it has saved, and does not resurrect the finished garden.

### 58. A wasted budget can still finish order 1

**Checks:** insufficient funds feedback, and the softlock bar on a fresh game. Do this on the new game from test 57.

1. Write the starting coins and the prices of a Daisy Bed, a belt, a Bundling Table, and a Packing Station.
2. Spend coins on purpose. Fill space with belts, or whatever is cheapest, until at least one of those required buildings is unaffordable. Stop before you have paved so much of the grid that a short chain cannot physically fit. Leave a 1-by-6 run of tiles free.
3. Try to place the building you cannot afford.
4. Remove bought structures using the normal delete tool and the documented refund.
5. Build a daisy path to packing and ship 2 raw daisies. Add a bundler first if you still have the coins to do the full bundle chain the brief asks for up front.

**Pass:**

- The unaffordable placement is refused, coins stay where they are, nothing appears on the tile, and the feedback names the lack of coins (`ui_error` if sound is on).
- After refunds, you can afford and place a working path that ships order 1 without editing the save and without a developer. If the refund rule is "full", this should be easy. If the refund rule leaves you unable to buy a bed and packing, this test fails and the economy is a blocker.
- Starting coins, before this waste, were enough to build the daisy bundle chain (bed, bundler, packing, and a short belt path) on their own. You already checked the arithmetic in test 29. This test is the spent-badly version.

### 59. Known limitations

**Checks:** incomplete work is written down, and it is not dressed up as finished.

1. Read `KNOWN_ISSUES.md` and `DESIGN_DECISIONS.md`.
2. Compare them with what you actually saw: interim art, missing tutorial, missing audio, missing expansion, missing browser test, removal rule, refund rule, hidden-tab behavior.

**Pass:**

- Both files exist.
- Anything you marked Later, and any interim art, is described there in plain language.
- The notes do not call a placeholder sprite final, and they do not claim a control works when you saw it do nothing.
- The removal rule, the refund rule, and the hidden-tab rule you wrote on the record card appear in the design notes and match the game.

---

## Traceability

Every acceptance line in the brief, and every control, feedback state, save case, softlock risk, and accessibility requirement, with the test that proves it.

### Acceptance criteria

| Brief requirement | Tests |
| --- | --- |
| A fresh player can complete all 6 orders without developer intervention | 6, 29, 31, 33, 35, 39, 41, 42, 45 |
| A Daisy Bed feeds a Bundling Table through belts, and bundles reach packing | 33 |
| Lavender and mixed bouquets work through real chains | 39, 41, 42 |
| Items do not duplicate, vanish, jump gaps, or overlap illegally | 29, 30, 33, 34, 46, 47, 48, 49, 50, 51 |
| Incorrect placement and blocked outputs produce clear feedback | 17, 29, 33 |
| Save and reload restore progress, inventory, machinery, and the current order | 24, 30, 32, 34, 37, 44 |
| The player cannot get permanently stuck on price or an unreachable unlock | 29, 36, 38, 40, 53, 58 |
| The game looks intentionally illustrated and cohesive at first launch | 8, 9 |
| All visible buttons, settings, and controls function | 12 through 27, 57 |
| It runs locally from documented commands and produces a static build | 1, 2, 3 |
| No runtime errors in a normal 20-minute session | 2, 45 |

### Controls

| Control | Tests |
| --- | --- |
| Left-click to place | 16, 19 |
| Left-click to select a building | 16 |
| Drag to lay belts | 19 |
| R to rotate, before and after placement | 18, 49 |
| On-screen rotate, if shown | 18, 49 |
| Right-click cancels | 23 |
| Esc cancels | 23 |
| Delete tool removes empty structures | 21, 48 |
| Right-click does not silently delete | 21 |
| Z and the undo control, when safe | 22, 31, 48 |
| Ghost, validity, and cost before confirmation | 15, 16 |
| Wheel zoom centered near the pointer, with limits | 20 |
| Drag on empty ground pans | 20 |
| Middle mouse pans, including while a tool is armed | 20 |
| Build mode and pan do not do each other's jobs | 20 |
| Tutorial skip and reopen | 12, 24 |
| No modal during routine play | 13 |
| Hover tooltip with cost and purpose | 14 |
| Inspector: recipe, progress, buffer, output direction | 16, 33, 42 |
| Pause | 25, 50 |
| Every speed, including the fastest | 25, 50 |
| Sound and music toggles, persisting | 7, 26, 32 |
| Settings | 26, 27 |
| Collapsible build palette | 9, 27 |
| New Game with confirmation | 57 |
| Continue only when a save exists | 6, 24, 57 |
| Keyboard reach for menus | 55 |

### Feedback states

| State or moment | Tests |
| --- | --- |
| Bed: growing, ready, blocked | 29, 39 |
| Machine: waiting for inputs, processing, ready to output, blocked | 33, 41, 42 |
| Wrong item or no matching recipe stops, with feedback | 33 |
| Full input buffer stops, with feedback | 33 |
| Invalid placement | 17, 19 |
| Insufficient funds | 17, 58 |
| Product-finished pop and belt motion | 33 |
| Order celebration, once | 31, 33, 35, 39, 41 |
| Sixth-order completion moment | 43 |
| Reduced motion calms decorative movement | 55 |
| Audio cues match the manifest, and pause fades music | 7, 25, 26, 43 |

### Save and reload

| Case | Tests |
| --- | --- |
| Autosave after a build | 24 |
| Autosave after an order completes | 32 |
| Periodic autosave during play | 37 |
| Occupancy, facing, buffers, in-transit items, money, unlocks, active order, completed orders, tutorial, settings | 32, 44 |
| Reload does not duplicate items or pay an order twice | 30, 32, 44 |
| Reload while a flower is between tiles | 30 |
| Reload while a craft is unfinished | 34 |
| Clean save | 5, 24 |
| Completed save | 5, 44 |
| Continue when a save exists, hidden when it does not | 6, 24 |
| New Game confirmation, cancel, and confirm | 57 |
| Schema version | 56 |
| Corrupted JSON, bad version, incomplete payload | 56 |
| Tab hidden, then shown | 51 |
| Processing time under a slowed frame rate | 52 |

### Softlock risks

| Risk | Tests |
| --- | --- |
| Starting coins cover a daisy bundle chain | 29 |
| Order rewards and prices keep the next machine in reach | 36, 40 |
| Unlocks arrive with the order that needs them | 38, 39 |
| Refunds match the written policy and can be used to recover | 54, 58 |
| Spending badly can still reach order 1 | 58 |
| No upkeep or fuel drain | 36, 44 |
| Expansion is optional, one time, and not a coin trap | 53 |
| Removing items does not destroy the only copy of a flower you need | 48 |

### Accessibility

| Requirement | Tests |
| --- | --- |
| Readable text and strong contrast | 55 |
| Keyboard-accessible menus and a visible focus | 55 |
| Status is not conveyed by color alone | 29, 33, 55 |
| Sound can be configured, including off | 26, 55 |
| Reduced motion, including the OS preference | 55 |
| Tile targets are large enough at default zoom | 20, 55 |
| Orders are not tiny pictograms with no words | 28, 55 |
| Player-facing American English | 11 |

### Edge cases named for this plan

| Edge case | Tests |
| --- | --- |
| Contested belt merges | 46 |
| Removing machines and belts that hold items | 48 |
| Rotating loaded belts and loaded machines | 49 |
| Undo after order completion | 31 |
| Reload mid-transport | 30 |
| Corrupted save | 56 |
| Tab hidden, then shown | 51 |
| Very fast speed setting | 50 |

### Tests the brief asks the project to automate

The producer still runs these by hand above. Test 4 and test 5 check that the automated suite exists and passes.

| Automated case in the brief | Manual counterpart |
| --- | --- |
| Recipe consumption | 33, 41, 42 |
| Blocked outputs | 29, 33 |
| Full buffers | 33 |
| Simultaneous belt moves | 47 |
| Contested destinations | 46 |
| Rotation | 18, 49 |
| Building removal | 21, 48 |
| Insufficient funds | 58 |
| Order allocation | 29, 31, 33 |
| Unlocks | 38, 39 |
| Saving and restoration | 24, 32, 34, 44, 56 |
| Clean save and completed save | 24, 44, and the smoke test in 5 |
| Processing time independent of frame rate | 29, 52 |
| Known limitations documented | 59 |

## Sign-off

The first pass is accepted when the score sheet is Pass on every row that the traceability table requires, the console review in test 45 is clean, and `KNOWN_ISSUES.md` matches what you saw.

Write one paragraph with the build label, the score, and any waiver. Keep the record card with it. A waiver cannot cover a blocker.
