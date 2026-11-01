# Accessibility checklist (slice)

Tick this while reviewing a build. The how and the contrast math are in `docs/design/ACCESSIBILITY.md`. This page is the pass/fail sheet.

Build: _______________  Date: _______________  Reviewer: _______________

Window at 100% browser zoom. Do one pass with the mouse and one pass with the keyboard only. Grayscale mode (OS or browser) is part of the state check.

Tick Pass when the line is true. On a miss, write what you saw on the line. A miss on contrast, keyboard play, or a sound with no visual is a fail for the slice. Rows marked **Later** are post-slice and are not a fail if they are absent.

## State and contrast

- [ ] Top bar, order text, inspector, settings, and error lines are dark ink on cream. Body text is readable. Cream letters on moss, sage, coral, or honey are a fail.
- [ ] Blocked shows an ink **!** on a cream disc and a sentence that says why (exit full, nothing connected, input full, or belt ends).
- [ ] A wrong item shows an ink **×** and a different sentence from blocked. The two states still differ in grayscale.
- [ ] Ready shows an ink check, the word Ready, and the flower or product waiting to leave.
- [ ] Waiting shows an ink **…** and the words for what is missing.
- [ ] Growing, ready, and blocked on one bed are easy to tell apart in grayscale.
- [ ] Valid placement, invalid placement, and the selection are three different shapes, each with a dark stroke you can see on the grass.
- [ ] Daisy, lavender, bundle, sachet, and bouquet are different shapes on both grass and a belt. Each has a dark outline.
- [ ] Daisy Bed and Lavender Bed share a planter and differ by the plant (round heads vs spikes).
- [ ] The exit direction of a bed, a machine, and a belt is a dark arrow. The inspector says the same direction in words (up, right, down, left).
- [ ] Locked grass is marked by a drawn edge, and building there says the plot is closed.

## Reduced motion

- [ ] Settings has one Reduced motion toggle, On / Off, with the line that the garden still runs.
- [ ] With it On, belt chevrons, bed bounce, machine loops, packing flutter, sparkles, the product ring, and petal confetti are still or absent.
- [ ] With it On, items still move along belts, the clock in the inspector still advances, and Fast still works.
- [ ] Turn it On, reload, and it is still On. Turn it Off, reload, and motion is back.

## Keyboard

- [ ] Tab reaches every top-bar control, the build menu, and the garden. A focus ring is visible on each.
- [ ] Arrow keys move a cursor on the garden. Enter places. R rotates. Shift+R rotates the other way. Esc cancels.
- [ ] A belt path can be laid from the keyboard: Enter, arrows, Enter. Esc drops the path.
- [ ] X or Delete removes a structure. Z undoes the last build. The basket and refund lines appear when they should.
- [ ] Selecting a bed, belt, or machine shows its status, recipe or contents, and facing, without using the mouse.
- [ ] P pauses and resumes. F toggles Fast. Ctrl+R still reloads the browser. Ctrl+W still closes the tab.
- [ ] New Game confirm traps focus. Esc or Cancel returns to the garden. The same is true for Settings.

## Type and the laptop window

- [ ] At 1366×768 and at 1280×800, 100% zoom, order and inspector text are at least 16px. Buttons are at least 44×44px and include a word, not only an icon.
- [ ] At those sizes, with the build menu open, garden tiles are at least 48px.
- [ ] At 200% browser zoom the order sentence is fully visible, and the top bar wraps instead of clipping.

## Sound

- [ ] Sound effects Off silences place, error, blocked, and the order chime. Music Off silences the loop. The two toggles are separate, and each shows On or Off in words.
- [ ] Music does not start until the first click or key.
- [ ] Both choices survive reload and survive New Game.
- [ ] A refused placement shows the error sentence, not only the error sound.
- [ ] A new block shows the **!** and the reason once, not a repeating banner.
- [ ] Finishing orders 1–5 shows the packed line and the coins. Order 6 shows the ending card.
- [ ] A delivery updates the order count on screen. Shipping a daisy does not stack a toast on every flower.
- [ ] A finished product and a bloom are visible at the moment their sounds play.

## Later (post-slice, not a fail)

- [ ] **Later.** Remappable keys, number keys for the build menu, a UI scale slider.
- [ ] **Later.** High-contrast theme, or a colorblind preview.
- [ ] **Later.** A caption history, volume sliders, or a screen-reader tour of every tile.
