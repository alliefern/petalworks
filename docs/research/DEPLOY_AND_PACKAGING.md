# Deploying and packaging Petalworks

Petalworks is a static browser game: Vite builds one `dist` folder, Phaser draws the garden, and React draws the HUD. There is no server, account, or API. The same folder can be hosted on Vercel, handed to Allie as a zip, or uploaded to itch.io, as long as asset URLs are relative and the page is served over HTTP rather than opened as a file.

Do this after the Vite toolchain is in git. The copy of `package.json` on `main` today lists Phaser and React only. Vite, TypeScript, Vitest, and Playwright are still local. Vercel installs from the committed manifest (devDependencies included) and will not see a laptop's `node_modules`. Commit `vite`, `typescript`, and a lockfile before the first import. Vercel does not run `npm test` or Playwright; those stay local.

## 1. Vercel

Import [alliefern/petalworks](https://github.com/alliefern/petalworks) from the Vercel dashboard (New Project, then the GitHub repo). The app lives at the repository root.

| Setting | Value |
| --- | --- |
| Framework Preset | **Vite** |
| Root Directory | repository root (leave the field blank) |
| Build Command | **`npm run build`** |
| Output Directory | **`dist`** |
| Install Command | default (`npm install`, which installs devDependencies) |
| Node.js Version | project default |

`dist` is Vite's default output directory. The committed build script is `tsc --noEmit -p tsconfig.json && vite build`, so `npm run build` typechecks and then bundles. A type error fails the deployment, which is what you want.

Vercel's Vite preset falls back to a bare `vite build` only when `package.json` has no `build` script. On the import screen, if Override is on and the command is only `vite build`, change it to `npm run build` so the typecheck still runs. Confirm the first build log shows `tsc` running.

Production branch stays `main`. That is Vercel's default when the repo has a `main` branch. A push or merge to `main` becomes the live site. Every push to any other branch creates a preview deployment, and a pull request gets its own deployment. Vercel comments on the PR with the URL (the comment can be turned off later under the project's Git settings). Each preview has two links: a branch URL that always tracks the latest push, and a commit URL that stays pinned. The first deployment of a brand-new project is always production, even if it came from another branch. Later pushes follow the branch rules above.

After import, open **Settings → Deployment Protection**. Use **Standard Protection** (or no protection). Standard Protection locks preview URLs and leaves the production domain public, which is what you want for a game with no secrets. If the team default is **All Deployments**, the live URL asks for a Vercel login and Allie cannot open it. When she needs to see a branch before merge, send a [shareable link](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection) for that preview.

Leave the Vite-on-Vercel SPA rewrite out. The documented catch-all sends every path to `index.html`, which is for client-side routers. Petalworks is one page. With that rewrite, a missing sprite comes back as HTML with status 200, and Phaser fails while trying to decode an image. A real 404 is easier to diagnose. There is no `api/` directory and there should not be one; this deploy is static files only.

### Asset paths and `base`

Vite's default `base` is `/`, which is correct for a site that lives at the root of a Vercel domain. itch.io and a copied folder do not. Both serve the game from a path you do not control. A URL that starts with `/` then leaves the game and 404s.

Set `base` to `'./'` in Vite config before the first build you hand to anyone. Vite rewrites the script and stylesheet URLs in `index.html` to be relative, and with a relative base it resolves module preloads from `import.meta.url` instead of an absolute path. The default browser target already includes Safari 16.4, which supports `import.meta`, so the legacy plugin is unnecessary for this desktop game. Check `npm run dev` after the change; `base` applies to the dev server too.

Two ways to load a sprite or a sound, and they should not be mixed:

- **Import the file** from the manifest (`import url from './file.png'`). Vite returns the URL it will serve, hashes the filename, and applies `base`. In dev the URL points at the source file; in the build it points at `assets/<name>.<hash>.<ext>`. Pass that string to Phaser. Do not prefix it again.
- **A plain string** such as `"/assets/art/bed_daisy_e_ready.png"` is not rewritten. Files dropped in Vite's `public` directory are copied as-is and the docs tell you to reference them as root-absolute paths. Those leading slashes are exactly what breaks a nested host.

Phaser's loader prepends `baseURL` and `path` only to relative filenames. An absolute URL, including one that starts with `/`, bypasses both. Call `this.load.setBaseURL(import.meta.env.BASE_URL)` once if the manifest stores relative paths, and keep every filename free of a leading slash. `import.meta.env.BASE_URL` has to be written exactly like that; Vite replaces it at build time and will not see a computed property.

Imported files smaller than 4 KiB are inlined as base64 by default. Several MP3s already in `assets/audio/` are under that line (`ui_hover.mp3`, `ui_click.mp3`, `build_rotate.mp3`, and others) while the Ogg beside them is just over it. Inlining would make the Safari fallback a data URL and the Ogg a real file. Set `build.assetsInlineLimit` to `0` so every sprite and sound stays a separate file Phaser can fetch and cache.

Filenames are case-sensitive on Vercel and on itch.io. macOS is not. `Bed_Daisy.png` and `bed_daisy.png` can both appear to work locally. Match the names in `docs/ASSET_SPECS.md` and `assets/audio/AUDIO_MANIFEST.md` exactly.

### Large files

The audio set already on `main` is small. The largest files are `music.mp3` (about 1.4 MB) and `music.ogg` (about 1.0 MB). The other cues are a few kilobytes each. Painted sprites at the spec size (128×128 or 144×144 PNG) stay in the same range. The whole first pass, art included, is on the order of a couple of hundred files and well under any host limit below.

Keep it that way:

- GitHub warns above 50 MiB per file and rejects a push above 100 MiB. A WAV or AIFF of the 90-second music loop is the likely way to hit that. Ship the Ogg and MP3 that are already in `assets/audio/`. Git LFS is extra machinery Vercel would also have to fetch; it is not needed at these sizes.
- A Git-connected Vercel project builds on Vercel. The Hobby "static file uploads" cap of 100 MB is the limit for a **CLI source upload**, not a cap on the built site. Output-file count has no hard ceiling; build time is capped at 45 minutes. This game is nowhere near either.
- itch.io's HTML zip limits are 1,000 files, 500 MB uncompressed, and 200 MB for any one file. Zip `dist`, not `node_modules`, and not `assets/audio/_source/`.

### Caching

Vercel caches static files on its CDN for the life of that deployment. The documented default `Cache-Control` is `public, max-age=0, must-revalidate`, so the browser revalidates. Leave `index.html` on that default. A refresh after a production deploy should show the new build.

Vite's JS and CSS in `dist/assets/` already have a content hash in the filename, and so do imported images. Those URLs change when the bytes change, so a long cache is safe. Vercel itself sends `public, max-age=31536000, immutable` for files under `/_vercel/immutable/` and `/_next/static/immutable/`. A Vite file is not automatically one of those. Add a year-long `immutable` header later only for paths whose names contain a hash.

The audio set and the art spec use stable names (`music.ogg`, `bed_daisy_e_ready.png`). An `immutable` header on those paths would pin an old mix or an old painting in people's browsers after you replace the file. Leave them on the default revalidate header, or import them so the hash does the busting.

Skip a service worker for this slice. The brief allows one so the game can run offline after the first load. A worker that caches `index.html` will keep serving the previous build after you deploy.

### Ogg and MP3

`assets/audio/` already ships every cue as `.ogg` (Vorbis) and `.mp3`, and the audio manifest says to prefer Ogg. That split is a Safari fact, not a style choice.

WebKit added Ogg Vorbis and Ogg Opus in Safari 18.4 (macOS 15.4, iOS 18.4, and the matching iPadOS and visionOS releases). Safari before that does not decode Vorbis. `decodeAudioData` only accepts formats the `<audio>` element can play, so the Web Audio path has the same gap. MP3 plays on Safari.

Pick the file once at startup:

```ts
const probe = document.createElement("audio");
const ogg = probe.canPlayType('audio/ogg; codecs="vorbis"');
const useOgg = ogg === "probably" || ogg === "maybe";
```

Load `.ogg` when `useOgg` is true, otherwise `.mp3`. The manifest's loop warning still applies: loop the Ogg buffer for `music`, `belt_tick`, and `machine_working`. MP3 frame padding can leave a short gap, so on a Safari that had to take the MP3 fallback those three loops may click or pause at the seam. One-shots are unaffected.

Unlock audio on the first pointer or key press (`AudioContext.resume()`), then decode. Browsers block sound until a user gesture, on Vercel and inside itch.io's iframe alike. The music bed stays silent until that gesture. itch.io's own note: a game set to auto-start can come up muted.

## 2. Handing the game to Allie

The link she should bookmark is the Vercel production URL. A zip is the portable copy. A desktop app is a later project.

### Zip she can keep

From a clean checkout, once the toolchain is committed:

```bash
npm run build
npm run preview
```

`vite preview` serves `dist` at `http://localhost:4173`. It is a local check of the production build, not a server to give to anyone, and it needs the repo. When the preview looks right, zip the **contents** of `dist` so `index.html` sits at the root of the archive:

```bash
cd dist && zip -r ../petalworks-web.zip .
```

The archive should look like this:

```text
index.html
assets/...
```

and not like `dist/index.html` or `petalworks/dist/index.html`.

She still cannot play it by double-clicking `index.html`. The build is ES modules (`<script type="module">`). Loading that page from a `file://` URL is blocked by the browser's module security rules, and the screen stays blank. She opens the unzipped folder with any static server:

```bash
npx serve .
```

or, with the Python that ships on macOS:

```bash
python3 -m http.server 8000
```

Then she opens the localhost URL the command prints. Saves do not travel with the zip. `localStorage` is per origin, so a garden built on the Vercel URL is a different save from localhost and from itch.io.

### itch.io

Create a project, set the kind to HTML, and upload `petalworks-web.zip`. itch.io only embeds a zip (or a single self-contained HTML file). RAR, 7z, and a handful of loose files are not an HTML game. The zip has to contain `index.html`; keep it at the root, as above. Paths inside the game must be relative. itch.io hosts the unzipped game in a subdirectory of its HTML CDN, and a path that starts with `/` is requested outside that directory and fails. The host is case-sensitive and answers a bad path with 403 rather than 404. Upload the files Vite emitted. Do not pre-gzip or Brotli-compress the PNGs or the audio; itch.io only special-cases gzip content and a `.br` suffix, and a wrongly marked file will not decode.

Limits, from itch.io's HTML guide: 1,000 files after extraction, paths of at most 240 characters, 500 MB uncompressed in total, 200 MB for any single file. This slice fits. If a later version grows past that, itch.io's own advice is to offer a downloadable build instead of a huge HTML embed.

Embed settings that match a mouse-driven canvas:

- **Click to launch in fullscreen**, with **Click to play** left on. The grid is 16×12 tiles at 64 px (1024×768) and can grow to 20×14 (1280×896), plus the HUD. A fixed "embed in page" box will clip that. Click to play also gives the gesture that unlocks audio. itch.io warns that auto-start can leave sound muted.
- **Scrollbars** off.
- **Mobile Friendly** off for the first pass. The brief is desktop-first. itch.io then warns phone visitors, and they can still try. On a phone, itch.io forces fullscreen launch anyway.

### Desktop wrappers

The first pass does not need one. The brief stops at a static build. A wrapper is worth it only if Allie specifically wants an icon that runs with no browser and no local server.

Both options load the same `dist` (with `base: './'`). Both need [Apple notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution) before a Mac app opens without a Gatekeeper warning, and that requires an Apple Developer account. Building the wrapper is a small follow-up. Signing and notarizing it is the part that needs Allie.

| | Tauri 2 | Electron |
| --- | --- | --- |
| What it is | A small native shell around the OS webview. `frontendDist` points at `../dist`, and Tauri embeds that folder and opens its `index.html`. | A copy of Chromium and Node with the game inside. Electron Forge is the documented packager. The window loads `dist/index.html` via `loadFile`. |
| Pros | Download is small. Memory use stays close to a browser tab. Official Vite guide matches this repo (`beforeBuildCommand`: `npm run build`, dev server on port 5173). | Canvas and audio match Chrome, including Ogg Vorbis, on every OS. Fewer "works here, blank on Safari" surprises. |
| Cons | macOS and Linux use WebKit, so the Safari audio gap and any WebKit canvas quirk come along. Windows uses WebView2, which is Chromium and is already present on Windows 11. Building it needs a Rust toolchain. An absolute `base` such as `/petalworks/` makes the packaged window load HTML where it expected JavaScript; keep `base: './'`. | The packager's own description: a zipped minimal app is about the size of the Electron binary for that OS. That is a large download for a garden game, and it uses more RAM. You produce a build per OS. |
| When to pick it | Default if a desktop icon is actually requested and the game already plays in Safari. | Only if WebKit misbehaves and a native app is still required. |

## 3. Recommended path

Give Allie the Vercel URL. Use the same `dist` zip for itch.io if she wants a page there. Skip Tauri and Electron until someone asks for an app icon.

1. Commit Vite, TypeScript, and the lockfile. Confirm `npm run build` writes `dist/index.html`.
2. In Vite config, set `base: './'` and `build.assetsInlineLimit: 0`. Point Phaser and the asset manifest at relative or imported URLs, with no leading slash. Run `npm run dev` and `npm run preview` and load one sprite and one sound in each.
3. Import the GitHub repo on Vercel. Preset **Vite**, build command **`npm run build`**, output **`dist`**, root directory blank, production branch **`main`**. No `vercel.json` rewrite.
4. Set Deployment Protection so the production URL is public (Standard Protection or off).
5. Push to a branch, open the preview, and play far enough to place a bed, hear the unlock, and reload. The reloaded preview should restore that preview's own save.
6. Merge to `main`. Open the production URL in Chrome and in Safari. In Safari older than 18.4, confirm the MP3 fallback plays. Confirm a missing image is a 404, not the game's HTML.
7. Zip `dist` as `petalworks-web.zip` with `index.html` at the root. Send Allie the production URL, and the zip with the one-line server command. Tell her a double-clicked `index.html` will be blank, and that her Vercel save is not inside the zip.
8. If she wants itch.io: upload that zip as an HTML game, fullscreen launch, click to play, mobile flag off. Play it once inside the itch.io page, not only locally.
9. Stop. A desktop wrapper is a separate decision.

## Sources

- Vercel, [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Configuring a Build](https://vercel.com/docs/builds/configure-a-build), [Deploying Git repositories](https://vercel.com/docs/git), [Environments](https://vercel.com/docs/deployments/environments), [Deployment Protection](https://vercel.com/docs/deployment-protection), [Limits](https://vercel.com/docs/limits), [CDN cache](https://vercel.com/docs/caching/cdn-cache), [Cache-Control headers](https://vercel.com/docs/caching/cache-control-headers). The Vite preset's fallback command `vite build` and output directory `dist` are the values in Vercel's [framework catalog](https://github.com/vercel/vercel/blob/main/packages/frameworks/src/frameworks.ts). With a `build` script present and no override, the static builder runs that script.
- Vite, [static deploy](https://vite.dev/guide/static-deploy), [`base`](https://vite.dev/config/shared-options#base), [relative base](https://vite.dev/guide/build#relative-base), [asset handling and `public`](https://vite.dev/guide/assets), [`build.outDir`](https://vite.dev/config/build-options#build-outdir), [`build.assetsInlineLimit`](https://vite.dev/config/build-options#build-assetsinlinelimit), [`build.target`](https://vite.dev/config/build-options#build-target), [module preload and relative base](https://vite.dev/config/build-options#build-modulepreload).
- Phaser 3.90, [LoaderPlugin](https://docs.phaser.io/api-documentation/3.90.0/class/loader-loaderplugin) (`baseURL`, `path`, absolute URLs skip both).
- WebKit, [Safari 18.4 media formats](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/) (Ogg Vorbis and Opus). Web Audio, [`decodeAudioData`](https://webaudio.github.io/web-audio-api/#dom-baseaudiocontext-decodeaudiodata) (same formats as `<audio>`). MDN, [`canPlayType`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canPlayType), [autoplay](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay), [modules and `file://`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules#other_differences_between_modules_and_standard_scripts).
- GitHub, [large files](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github) (50 MiB warning, 100 MiB block).
- itch.io, [Uploading HTML5 games](https://itch.io/docs/creators/html5) (zip layout, subdirectory hosting, case, 403s, size limits, embed options, compression).
- Tauri, [Vite guide](https://v2.tauri.app/start/frontend/vite/) and [`frontendDist`](https://v2.tauri.app/reference/config/#frontenddist). Electron, [application distribution](https://www.electronjs.org/docs/latest/tutorial/application-distribution), [`loadFile`](https://www.electronjs.org/docs/latest/api/browser-window#winloadfilefilepath-options), [packager size note](https://electron.github.io/packager/main/).
- In this repo: `package.json` (`build` script), `docs/ASSET_SPECS.md` (sprite filenames and the original Ogg-plus-MP3 note), `assets/audio/AUDIO_MANIFEST.md` (which file to prefer, and the MP3 loop gap).
