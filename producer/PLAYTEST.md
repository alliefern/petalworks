# Playtest: first playable

## Run it
```bash
npm install
npm run dev
```
Open http://127.0.0.1:5173 in Chrome, Edge or Firefox on a desktop. Click **New Game**.

(Or `npm run build && npm run preview` → http://127.0.0.1:4173 for the production build.)

## What to try (about 15 minutes)
1. Read Nell's order (top right): 2 daisies, pays 50.
2. Click **Daisy Bed** on the shelf, hover the lawn (a ghost shows valid/invalid), press **R** to turn its arrow, click to plant.
3. Click **Conveyor Belt**, then click-and-drag a path from the bed's arrow to the crate (the Packing Station on the right, already there). Belts turn corners as you drag.
4. Wait. Daisies bloom every 4 s, ride the belt, and the counter in the order card ticks up only when one arrives. The order completes with a chime and a card; coins go up by 50.
5. Try **Pause** (or **P**), the **2×/3×** buttons (or **F**), **Undo** (or **Z**), and the trowel **Remove** tool (refund).
6. Otto wants bundles: put a **Bundling Table** on the path (daisies in from any side, bundles out of its arrow). Click the table to inspect it: recipe, what's inside, progress in seconds.
7. Leave a one-tile gap in a belt: the flower waits at the end with a `!` badge and the inspector says why. Point a belt at a machine that doesn't want the item: `×` badge.
8. Refresh the page mid-delivery, click **Continue**: same garden, same coins, same order, that flower once.
9. Remove a belt with a flower on it: the flower goes to the **Basket** in the shelf; click it, then an empty belt, to send it back out.
10. Keep going: lavender (order 4, Lavender Bed unlocks and **Open Plot** appears), sachets (Drying Bench), the bouquet (Arrangement Table takes a bundle and a sachet from any sides). After order 6 the market opens and everything you deliver sells.
11. Settings (gear): sound, music, reduced motion, replay tips, new game. All persist across reload.
12. Keyboard only: click the lawn once, then arrows move a cursor, Enter places/selects, R rotates, Esc cancels, B opens the shelf.

## Things worth telling me
- Anything that vanished, doubled, or jumped a gap.
- A moment where you didn't know why a flower wasn't moving.
- A button that didn't do what it looked like.
- Anything that read as a programmer sketch rather than a painted stand-in.
