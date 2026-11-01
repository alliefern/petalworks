# Petalworks

A cozy flower-factory automation game for desktop browsers. Grow daisies and lavender, route them on conveyor belts through little machines, and fill the village's orders.

- **Engine:** Vite + TypeScript, Phaser 3 (world), React (HUD), pure TypeScript simulation.
- **No backend, no accounts, no ads.** Progress saves to the browser's local storage.

## Commands

```bash
npm install          # once
npm run dev          # http://127.0.0.1:5173
npm test             # Vitest: simulation rules (31 tests)
npm run build        # type-check + production build into dist/
npm run preview      # serve dist/ at http://127.0.0.1:4173
npm run test:e2e     # Playwright browser smoke test (builds are served by `preview`; run `npm run build` first)
npm run shots        # headless screenshots into producer/shots/ (needs `npm run preview` running)
node tools/soak.mjs http://127.0.0.1:4173/ 120   # headless soak: full layout at 3x for N seconds, fails on any runtime error
npm run art:interim  # regenerate the interim sprite set (Python 3 + Pillow)
npm run art:pack     # pack assets/art PNGs into WebP atlases in src/generated/ (runs automatically before dev, test and build)
node tools/firstload.mjs http://127.0.0.1:4173/   # bytes and seconds until New Game works at Slow 4G
```

Playwright uses the system Chrome at `/usr/bin/google-chrome` by default. Point `CHROME_PATH` at another Chromium build if needed, or run `npx playwright install chromium` and remove `executablePath` from `playwright.config.ts`.

## Deploying

The build is static. `base` is `./` so `dist/` works at any path (Vercel, itch.io, a zip served by `npx serve`). Do not open `index.html` from `file://`; it needs an HTTP server. See `docs/research/DEPLOY_AND_PACKAGING.md`.

## Layout

| Path | What |
| --- | --- |
| `src/sim/` | Simulation: types, data (`data/`), grid, transport, production, orders, actions (`game.ts`), save/migrations. No React or Phaser imports. |
| `src/app/` | Runtime: `store.ts` (fixed-tick loop, actions, UI state, autosave), `audio.ts`. |
| `src/game/` | Phaser: scene, camera, sprite registry, code-drawn accessibility overlays. |
| `src/ui/` | React HUD. Player-facing text lives in `src/ui/strings.ts`. |
| `src/assets/manifest.ts` | Semantic sprite keys → built files. Source art is `assets/art/*.png` by file name (interim stand-ins in `assets/interim/`); `tools/pack-art.mjs` turns them into WebP atlases in `src/generated/` at build time. |
| `assets/audio/` | Sound set (see `AUDIO_MANIFEST.md`). |
| `tools/` | Interim art generator, screenshot script. |
| `docs/` | Brief, producer notes, asset specs, design docs. |

Design choices and trade-offs: `DESIGN_DECISIONS.md`. What is unfinished: `KNOWN_ISSUES.md`.
