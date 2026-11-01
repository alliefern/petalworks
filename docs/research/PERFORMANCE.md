# Performance audit of Petalworks

Measured on the live site, [https://petalworks.vercel.app](https://petalworks.vercel.app), on November 1, 2026. The page that was up matches this repo: Vite builds one `dist`, Phaser draws the garden, React draws the HUD, and saves stay in `localStorage`. This note does not change the game. Another pass can apply the fixes below.

The browser was headless Chrome 156. It drew with SwiftShader, a software stand-in for a GPU, and headless Chrome also turns GPU compositing off. Read the frame rates as software-renderer numbers from this machine. Byte counts, request lists, and script time stand on their own, and those are the numbers to use for the load.

## What the first visit actually downloads

The title screen paints quickly. The New Game button stays disabled until Phaser has finished preloading every garden sprite. That wait is the first-load problem.

Cold load, cache turned off, window 1280×800:

| | Fast link (this machine) | Slow 4G |
| --- | --- | --- |
| New Game becomes clickable | 0.89 s from navigation start (0.65 s after the document starts loading) | 23.0 s |
| First paint | 116 ms | (not separated; the button time is the one that matters) |
| First contentful paint | 328 ms | |
| DOMContentLoaded | 239 ms | 2.4 s |
| Load event | 447 ms | 11.7 s |
| Bytes transferred | 4,469,754 (about 4.47 MB) | same bytes |

Slow 4G here is the usual DevTools setting: 1.6 megabits per second down, 750 kilobits per second up, 150 ms delay. 4.47 MB at 1.6 megabits per second is about 22 seconds, which matches the 23 second wait. On that link the button is waiting on the download.

What those 4.47 MB are, from the resource timing of the cold load:

| | Files | Transferred | Decoded |
| --- | --- | --- | --- |
| JavaScript (app, React, Phaser, a tiny runtime) | 4 | 420 KB | 1.49 MB |
| CSS | 1 | 4 KB | 13 KB |
| Nunito (weights 400, 700, and 800) | 3 | 175 KB | 376 KB |
| Garden PNGs | 152 unique, plus 3 repeats | 3.86 MB | 3.80 MB unique |
| Favicon | 1 | 5 KB | 5 KB |

The Phaser file is most of the script: about 327 KB transferred, out of 420 KB. The app and React are about 45 KB each once compressed.

The three repeated PNGs are the daisy, the sachet, and the bouquet on the title screen. The title `<img>` tags and Phaser both ask for them. With the cache forced off, each one downloaded twice (about 22 KB extra). A normal visit downloads each once. The practical first-load size is about 4.45 MB.

A second visit, with the cache left on, transferred 49 KB and the button was ready in 0.74 s on this same fast link. The image bodies came from cache. Chrome still rechecked all 164 URLs, because every hashed file is sent with `cache-control: public, max-age=0, must-revalidate`. On a fast link those checks are cheap. On a slow or distant link they are a round trip per file before the cached copy is used.

## How the files get requested

Nothing is lazy about the garden art. `src/assets/manifest.ts` imports every PNG under `assets/art` and every PNG under `assets/interim` with an eager Vite glob. `src/app/audio.ts` does the same for every `.ogg` and every `.mp3`. An eager `?url` import puts the URL in the JavaScript bundle. The browser does not download the bytes until something asks for that URL.

Then `src/ui/App.tsx` creates the Phaser game as soon as the page mounts, including on the title screen. `SpriteRegistry.preload` in `src/game/sprites.ts` calls `scene.load.image` for every key from `allSpriteKeys()`: 170 keys, covering grass, hedges, belts, all four facings of every bed and machine, packing frames, items, badges, tiles, decorations, and effects. The New Game button in `src/ui/TitleScreen.tsx` stays disabled until that preload finishes and `PetalScene.create` sets `ready`.

The build does collapse identical files. Several "working" frames are the same pixels as the idle frame (`machine_*_idle` and `machine_*_work0` for the arrangement and bundling tables, plus a few drying and packing frames). Vite gives those one URL, so 170 keys become 152 downloads. `docs/ASSET_SPECS.md` says the build packs sprites into sheets. This build does not. Each sprite is its own PNG request.

`assets/interim` is 109 PNGs, 1.52 MB on disk. The live page requested none of them. Final art exists for every preloaded key, and `resolveSprite` prefers `assets/art`. The interim files are still part of the production bundle because the glob is eager. They add deploy size, not first-load size, as long as every final file is present.

UI icons (`ui_coin.png` and the rest, 17 files, 180 KB) are not in `allSpriteKeys()`. They download when a React `<img>` mounts. Starting a game pulled in 7 of them (about 74 KB): coin, order, pause, undo, settings, help, and remove. The others wait for the control that uses them.

Audio waits for a click, which is correct. `AudioEngine.unlock` runs from the title button and from the first pointer on the page. On New Game, Chrome downloaded six Ogg files and nothing in MP3:

| Cue | Bytes |
| --- | --- |
| `music.ogg` | 1,029,220 |
| `deliver.ogg` | 7,027 |
| `item_pop.ogg` | 5,845 |
| `ui_error.ogg` | 5,069 |
| `build_place.ogg` | 4,875 |
| `ui_click.ogg` | 4,851 |

That is 1.06 MB of sound, plus the 74 KB of icons, on the click that enters the garden. The music file is a 90 second stereo loop at about 91 kilobits per second. The MP3 twin is the same length at about 125 kilobits per second (1.40 MB). This Chrome visit fetched the Ogg set. A browser without Ogg fetches the MP3 set instead, one format per visit. The other cues are a few kilobytes each. Both formats of every cue are still uploaded with the site (Ogg set 1.16 MB, MP3 set 1.51 MB).

Fonts are four full Nunito TTFs in `src/ui/styles.css`, one per weight, with `font-display: swap`. The first screen uses 400, 700, and 800, so those three download immediately (175 KB on the wire). Weight 600 is only used on the small build hint, so `Nunito-600.ttf` stays put until that hint is on screen. Brotli brings each TTF down from about 125 KB to about 58 KB. They are still whole font files, not a subset.

`vite.config.ts` sets `build.assetsInlineLimit` to `0` and `base` to `'./'`. Small sounds and sprites stay separate files, which is what you want once the cache headers are right. They are not inlined into the JavaScript.

## A full garden, running at 3×

The slice tops out at the expanded yard: 20 by 14 tiles. For the run, the page unlocked every building, opened the far plot, and filled all 280 tiles: 1 packing station, 28 daisy beds, 28 lavender beds, 12 bundling tables, 15 drying benches, 15 arrangement tables, and 181 belts. Speed was set to 3. After a few seconds, 48 belts held an item. Over the longer run that settled at 150 items, which is most of the belts full.

The simulation is 10 ticks a second (`TICK_HZ` in `src/sim/data/balance.ts`). At 3× that is 30 ticks a second. Across three minutes the tick counter advanced at 30.3 ticks a second. The sim kept up. It is driven by its own `requestAnimationFrame` in `GameStore`, and a slow frame does not make it fast-forward more than 250 ms.

Frame rate on the software renderer, full yard:

| Window | Canvas buffer | 3× | 1× | Paused |
| --- | --- | --- | --- | --- |
| 1280×800, pixel ratio 1 | 1280×800 | 17 fps | 18 fps | 18 fps |
| 1366×768, pixel ratio 1 | 1366×768 | 18 fps | 18 fps | 18 fps |
| 1920×1080, pixel ratio 2 | 1920×1080 | 10 fps | 10 fps | 10 fps |

Pausing did not raise the frame rate. Dropping from 3× to 1× did not either. Making the window larger did. At 1920×1080 the buffer was still 1920×1080, not 3840×2160: `createGame` never sets Phaser's `resolution`, and the default is 1, so a high-density screen does not allocate a double-size canvas. The 10 fps versus 18 fps tracks the number of pixels (about twice as many), on a renderer that paints in software.

Over a 5 second slice of that full yard at 3×, Chrome's main-thread counters were:

- Script: 30 ms per second of wall time
- Style recalculation: under 1 ms per second
- Layout: under 1 ms per second
- All main-thread tasks together: about one full second per second

The last line is the software paint. Headless Chrome was compositing on the main thread, and SwiftShader was pegged. The JavaScript of the sim, the HUD, and the per-frame sprite updates was about 30 ms out of that second, which is roughly 2 ms of script on each of those 17 frames. That sits comfortably inside a 60 fps budget. The software paint is what filled the frames on this machine.

Memory over the three minutes at 3×, 1280×800, used JavaScript heap (the precise counter):

| Time | Heap used |
| --- | --- |
| 0 s | 24 MB |
| 30 s | 26 MB |
| 60 s | 33 MB |
| 90 s | 19 MB |
| 120 s | 19 MB |
| 150 s | 28 MB |
| 180 s | 32 MB |

It went up, the garbage collector brought it back down, and it did not stair-step. At the start of play the document had about 420 DOM nodes. Nothing in this run looks like a leak.

For a sense of the draw: the expanded ground is 280 grass tiles, plus a hedge ring of about 72 tiles that each also draw grass. Each of the 280 structures gets a main sprite, an end cap, an arrow, a pennant, and a disc (hidden ones are still objects). 150 items on belts are two sprites each (a tinted outline and the item). That is on the order of 2,000 image objects, using 152 separate textures. Phaser can batch only runs of the same texture. Grass alternates among four textures, and belt frames change as time moves, so a full yard is a long series of small draws. A real GPU will do this faster than SwiftShader. A weak integrated GPU can still feel it, which is why the atlas is in the list below.

## What would hurt a low-end laptop or a Steam Deck

The Deck's screen is 1280×800, the size already used above. The laptop case people still have is often 1366×768. Neither number is large. The canvas already covers the whole window (`.world` is `position: absolute; inset: 0`) and antialiasing is on (`render.antialias: true` in `src/game/createGame.ts`). At 1280×800 that fill is ordinary for the Deck's GPU. The risky parts are elsewhere.

1. **The download before the button works.** A laptop on a slow connection waits on 4.45 MB and 152 images. Twenty-three seconds to a disabled button is the bad case measured here. Cafe wifi is often faster than Slow 4G. It is still a multi-megabyte wait of separate PNG decodes on the main thread, which is the same thread a low-end laptop uses for everything else.

2. **152 textures while the garden is full.** This is the Deck item. The framebuffer size is ordinary for that screen. The number of textures and sprites is the part to try on hardware. The sim held 30 ticks a second while the software renderer was at 17 fps, and script time stayed near 30 ms per second.

3. **The whole HUD re-renders on every tick.** `useStoreVersion` subscribes to every `emit()`, and `advance` emits whenever a tick ran. At 3× that is about 30 React renders a second of the top bar, order, tutorial, and palette. It did not show up as layout or style time in this run. It will matter more if the HUD gets heavier, not at today's size.

4. **Return visits recheck every file.** `max-age=0` on hashed names. A laptop with a high ping pays that on every refresh, even though the bytes are already on disk.

What already helps, and should stay:

- The canvas buffer follows CSS pixels, not the device pixel ratio. A retina laptop does not get a four-times-larger framebuffer.
- Sound is one format per browser, and it starts on the click, not during the first paint.
- There is no service worker, so a deploy is not stuck behind an old cached `index.html`.
- Saves are one JSON string. A full yard is still a small `localStorage` write every 10 seconds and on each build action. That is not a load or a frame problem.
- The sim drops catch-up at 250 ms, so a background tab does not fast-forward a huge backlog when it comes back.

## Fixes, in the order worth doing them

### 1. Ship the garden sprites as WebP, and pack them into an atlas

This is the load fix and the Deck fix in one change.

The 152 unique preloaded PNGs are 3,797,494 bytes. The same pixels, encoded with ffmpeg's libwebp at quality 82, are 896,442 bytes. At quality 75 they are 784,094 bytes. That is about 76 percent smaller at quality 82. I did not sit and compare every sprite by eye. Someone should look at a bed, a belt frame, and a hedge before picking the quality.

`resolveFile` in `src/assets/manifest.ts` checks the `.png` first and only then the `.webp`. Dropping WebP files next to the PNGs will do nothing until that order flips, or until the PNGs are no longer the files the glob resolves.

An atlas (one or a few sheets, still WebP) is the part that helps the running game. `src/game/sprites.ts` would load a sheet instead of calling `scene.load.image` once per file, and `PetalScene` would keep using frame names. Expect the first-load transfer to fall from about 4.45 MB to about 1.6 MB, and the Slow 4G wait to fall from 23 seconds toward about 8 seconds, if the wait stays proportional to bytes the way it did here. Expect the full yard to draw in far fewer texture switches. Files: `src/assets/manifest.ts`, `src/game/sprites.ts`, `src/game/PetalScene.ts`, and the art files under `assets/art`. `docs/ASSET_SPECS.md` already asks for packed sheets. The code never got that step.

While packing, drop `ground.locked` from `allSpriteKeys()`. It is preloaded (37,758 bytes) and never drawn. The closed plot is a tinted grass fill plus a label. The comment in `rebuildGround` says so.

### 2. Cache the hashed files for a long time

Every built file name has a content hash, and Vercel still sends `public, max-age=0, must-revalidate`. A reload on the fast link moved only 49 KB, but it rechecked 164 URLs. Set a long `max-age` and `immutable` on `/assets/*`. Leave `index.html` on a short or zero max-age so a deploy still shows up. This is a hosting header, not a game-code change (a `vercel.json` header rule, or the project settings). First visit: no change. Later visits: no recheck of the sprites, scripts, or fonts.

### 3. Let the title say it is loading

First paint was 328 ms. The button then sat disabled until the last sprite arrived: 0.6 seconds here, 23 seconds on Slow 4G. The player is looking at a title that will not start. Two small options, and the first is enough if the sprites shrink:

- Keep the button disabled, and put a "Loading the garden" line on the title until `scene.ready`. Files: `src/ui/TitleScreen.tsx`, `src/ui/App.tsx`.
- Or enable the button immediately and run Phaser's preload after the click, with the same line over the garden. The bytes move to after the click. The page itself is ready at first paint.

Shrinking the sprites (fix 1) matters more than either of these. The line is so the wait is visible.

### 4. Leave the per-frame code until the yard grows

These are real, and they were not the cost in this run. Script time was about 30 ms per second with 280 buildings at 3×. Do them when a profile on a real GPU shows script time climbing, or when the garden gets several times bigger.

- `PetalScene.updateView` calls `setDisplaySize`, `setImage`, and `feeders()` for every structure on every frame, including belts whose shape did not change. Skipping unchanged views would cut JavaScript as the belt count grows. File: `src/game/PetalScene.ts`.
- The React tree re-renders on every sim tick. A subscription that updates coins, the order, and notices, and does not render the whole `App` at 30 Hz, keeps the HUD cheap. Files: `src/ui/useStore.ts`, `src/ui/App.tsx`, `src/app/store.ts`.
- `placeLockedLabels` reads `getComputedStyle` and `getBoundingClientRect` for the HUD cards every frame while a closed plot is showing. That is a layout read inside the render loop. Cache the card rectangles until a resize. File: `src/game/PetalScene.ts`.

Expected gain today: small. The measured frame time did not move when the sim was paused.

### 5. Smaller follow-ups

- **Interim art in the production glob.** 1.52 MB of `assets/interim` is in the bundle and was not requested. Stop importing that folder in production (`src/assets/manifest.ts`). First-load gain today: none. It keeps a missing final sprite from pulling a second, older file, and it drops 1.52 MB from the deploy.
- **Music.** 1.03 MB on the first click, for a 90 second loop at about 91 kilobits per second. A lower bitrate, or mono, saves a few hundred kilobytes and a few seconds of Slow 4G before the music starts. The garden does not wait on it. Files: `assets/audio/music.ogg`, `assets/audio/music.mp3`. The five warmed cues are 33 KB together. Leave those.
- **Fonts.** 175 KB on the wire for three full TTFs, plus a fourth later. A Latin subset in woff2, still in `src/ui/styles.css` and `src/ui/fonts`, is the usual cut. I did not build the subset, so there is no measured size here. It is a few percent of the first load next to the PNGs.
- **A slimmer Phaser build.** The game sets `audio: { noAudio: true }` and plays through its own engine. Phaser's audio code is still in the 327 KB file. A custom build can trim that. It is optional, and it is smaller than the image win. File: `src/game/createGame.ts` and whatever build step produces the Phaser bundle.

## Already in good shape

- Antialiasing stays on. The art is painted, and `pixelArt` is already false. A real GPU profile would be the reason to revisit it.
- The canvas buffer already matches the CSS size, so a high-density laptop stays at one pixel per CSS pixel.
- Ogg and MP3 both ship, and a visit fetches one of them. Safari still needs the MP3.
- The sim step, at 280 buildings and 3×, held 30 ticks a second with room to spare in the script budget.
- Memory over three minutes of a full, running yard rose and fell with garbage collection, and stayed in a band of about 19 to 33 MB.

## How this was measured

Live page, November 1, 2026, cache disabled for the cold numbers, then a second navigation with the cache left on. Slow 4G was applied with Chrome's network emulation at 1.6 Mbps down, 750 Kbps up, and 150 ms latency. The full-yard run used the game's own `window.petalworks` store: unlock every kind, expand, place a building or a belt on every open tile, set speed to 3, and sample frames for several seconds at each speed, then for three minutes. Heap figures are Chrome's precise `performance.memory` counter. Main-thread time is Chrome's `TaskDuration`, `ScriptDuration`, `LayoutDuration`, and `RecalcStyleDuration` over a 5 second window. WebP sizes are ffmpeg libwebp over the 152 unique PNGs in `assets/art`, quality 75 and 82, excluding the `ui_` icons. The renderer string was `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)`.
