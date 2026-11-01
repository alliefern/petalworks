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

## Copy
- `docs/content/copy.json` is wired for every string it covers. About 60 short strings it does not cover yet (zoom/fit buttons, "Order 1 of 6", the open-market line, a few error lines, extra keyboard rows) live in `EXTRA` in `src/ui/strings.ts` with the same key style, listed in `producer/QUESTIONS.md` #7.
- The copy's "place a Packing Station" opening tip is skipped because the station is pre-placed.

## Platform
- Desktop mouse and keyboard only. Touch is not implemented.
- No service worker; the game needs its first load online (nothing is fetched after that).
- Safari older than 18.4 falls back to MP3; the three loops (music, machine hum, belt cadence) may have a tiny seam there.
- Playwright runs against the system Chrome at `/usr/bin/google-chrome`; it does not install its own browser.
