# Known issues and limitations

Honest list. Nothing here is disguised as finished.

## Art
- All 187 sprites are the art team's final files (`assets/art/`). The interim generator (`tools/make_interim_art.py`, `assets/interim/`) stays as the fallback for any file that is later renamed or removed.
- `ground_locked.png` is not used: its per-tile border reads as a grid. The closed plot is drawn as lawn with a moss tint and one outline instead (see `producer/QUESTIONS.md` #9).
- Status discs, tile rings, exit arrows and item outlines are drawn in code over the art, per `docs/design/ACCESSIBILITY.md`. The painted pennant glyphs sit under the ink discs.

## Gameplay
- No generated orders after order 6. The sandbox is an open market (goods sell on arrival) rather than endless orders.
- Screen readers get a polite announcement for the keyboard cursor tile; there is no per-tile tour of the whole garden.
- Balance has been checked against `docs/design/BALANCE.md` and the Vitest affordability test, not against human playtests. The e2e harness drives the sim faster than a person would.

## Plot shape
- The hedge's inner corners are the strip pieces cropped to their meeting square; if the art team paints dedicated inner-corner pieces they can replace that in one place (`rebuildGround` in `src/game/PetalScene.ts`).
- Saves from the box-shaped yard load with an extra `legacy-potting` plot (and `legacy-south-rim` if expanded) so their notch-corner buildings stay valid; those gardens keep the old box outline.

## Copy
- `docs/content/copy.json` is wired for every string it covers. About 60 short strings it does not cover yet (zoom/fit buttons, "Order 1 of 6", the open-market line, a few error lines, extra keyboard rows) live in `EXTRA` in `src/ui/strings.ts` with the same key style, listed in `producer/QUESTIONS.md` #7.
- The copy's "place a Packing Station" opening tip is skipped because the station is pre-placed.

## Layout
- Fit frames the yard in the free column between the tip and order cards, below the top bar and above the palette, measured from the real HUD. When the whole yard cannot sit beside both side cards at the 40 px tile floor (below about 1300 px wide, since the yard is now about 20 tiles across), Fit closes the tip card (the Tips button brings it back) and, as before, the palette. On a window shorter than 700 px (1024×640), Fit may show tiles down to 34 px instead of 40 so the whole yard is on screen at once (ANSWERS #11, a Fit-only exception; default framing keeps 40 and the player can zoom back in). The side cards never cover the yard, and the default framing is always clear. `tools/layoutcheck.mjs` checks this from 1024×640 to 3840×2160.
- The canvas renders at the device pixel ratio (capped at 2×) within a 16-megapixel budget, so a 4K monitor at 2× renders at about 1.4× rather than 2×.

## Performance
- First load at Slow 4G is about 7.8 s to a clickable New Game (1.43 MB). The remaining weight is Phaser's bundle and three full Nunito TTFs; font subsetting and a slimmer Phaser build are not done.
- The build step needs `sharp` (a native module) to pack the art; `npm ci` installs it.

## Platform
- Desktop mouse and keyboard only. Touch is not implemented.
- No service worker; the game needs its first load online (nothing is fetched after that).
- Safari older than 18.4 falls back to MP3; the two factory loops (machine hum, belt cadence) may have a tiny seam there. Music is generated, so it has no file or seam.
- Playwright runs against the system Chrome at `/usr/bin/google-chrome`; it does not install its own browser.
