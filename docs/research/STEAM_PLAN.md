# Steam release plan for Petalworks

Checked against Valve's public Steamworks pages, Electron's GitHub release, and the Tauri 2 docs on **November 1, 2026**. The Steamworks site you see after you sign in is the copy that counts. If a page there disagrees with this file, follow the site and update this note.

This is a plan for Allie (the owner) and for the lead developer. It does not change the game. The browser build on Vercel and itch.io stays the way [DEPLOY_AND_PACKAGING.md](DEPLOY_AND_PACKAGING.md) describes it. Steam is a later desktop copy of that same build.

A companion checkbox list is in [STEAM_CHECKLIST.md](STEAM_CHECKLIST.md).

## In short

Petalworks can go on Steam. The copy that should ship there is an **Electron** app: a small window that holds the same Vite build the browser already uses. Electron is a large download (about 115–151 MB of Chromium before the game is added) and it has to be signed for the Mac. It is still the wrapper that lines up with Steam's overlay and with the JavaScript Steam library that exists today. Tauri stays the better choice only for a private desktop icon, which the deploy notes already say.

You can pay Steam's **$100 fee now**, before any desktop build exists, and get an app ID. Valve's public docs do not give a deadline for uploading the game after that payment. A public Coming Soon page can go up once the store checklist is approved. That page needs real gameplay screenshots, so it should wait until the painted garden is on screen. The fee is not refunded if the game never ships. Steam pays it back in a later month once that game has made at least $1,000 in adjusted sales.

The slow part of signup is identity, tax, and bank details (Valve's own pages say anywhere from a couple of weeks to 30 days). The first games also have a waiting period after the fee before release: **21 days** in the Steamworks onboarding doc, **30 days** on the public Steam Direct page. Those two official pages disagree. Plan on 30. A Coming Soon page has to sit in public for at least two weeks before release, and each review is usually a few business days. None of that requires the game to be finished today.

Leave Steam Cloud, achievements, and controller support off the store page until the build Valve reviews can actually do them. The six-order garden is a strong demo. The game described on the store page should be the full workshop in the progression roadmap, unless you deliberately release the short version as Early Access and say so.

## 1. Which wrapper to ship

A Steam customer downloads a program. They do not open a browser tab. The program's only job is to open the `dist` folder the Vite build already produces, with `base: './'`, which is already set in `vite.config.ts`.

Three shells can do that. The recommendation is at the end of this section.

### Electron

Electron is a copy of Chromium plus Node, with the game loaded inside a window. [Electron's distribution guide](https://www.electronjs.org/docs/latest/tutorial/application-distribution) is the packaging overview. The window loads `dist/index.html` with `loadFile`, the same approach the deploy notes already describe.

**Size.** You ship a build per operating system. The runtime is most of the download. The game itself stays small (the deploy notes put the first-pass site, art included, well under the usual host limits). [Electron Packager](https://electron.github.io/packager/main/) says a zipped, minimal Electron app is about the same size as the zipped prebuilt binary for that platform and version (the `electron-v…-platform-arch.zip` files). The official Electron **45.2.1** zips, published October 31, 2026, are:

| Runtime zip | Bytes | About |
| --- | --- | --- |
| Windows x64 | 158,187,314 | 151 MB |
| Linux x64 | 123,777,540 | 118 MB |
| Mac, Apple silicon | 120,788,457 | 115 MB |
| Mac, Intel | 124,990,038 | 119 MB |

Source: the asset list on the [Electron 45.2.1 release](https://github.com/electron/electron/releases/tag/v45.2.1), read from GitHub's API the day this plan was written. Petalworks' own files sit on top of that. For a garden game, the Chromium runtime is the download.

**What you gain.** The window is Chromium on Windows, Mac, and Linux. Ogg Vorbis, canvas, and audio match the Chrome build you already test. The Safari audio gap in the deploy notes does not apply inside this window. [steamworks.js](https://github.com/ceifa/steamworks.js) is a Node library, so it loads in Electron's main process. Its readme documents `electronEnableSteamOverlay()` for the Steam overlay.

### Tauri

Tauri 2 is a small native shell around the operating system's own webview. Its [Vite guide](https://v2.tauri.app/start/frontend/vite/) matches this repo: `frontendDist` points at the built site, and the dev server can stay on port 5173. The [size page](https://v2.tauri.app/concept/size/) describes the binaries as very small. Tauri's introduction says a minimal app can be under 600 KB because the browser engine is already on the computer ([Tauri start](https://v2.tauri.app/start/)). Petalworks' pictures and sounds sit on top of that. The result is still a small download next to Electron.

**What you take on.** Mac and Linux use WebKit. Windows uses WebView2, which is Chromium and is already present on Windows 11. The deploy notes already flag the WebKit side: older Safari cannot play Ogg Vorbis, and any WebKit canvas quirk comes along. Building the shell needs a Rust toolchain. steamworks.js does not run here, because it is a Node addon. A Tauri build would talk to Steam from Rust (the [steamworks crate](https://github.com/Noxime/steamworks-rs) that steamworks.js itself is built on). That is a second language in a project that is otherwise TypeScript.

### NW.js, and a hand-built browser

NW.js is the other long-standing Chromium shell. [Greenworks](https://github.com/greenheartgames/greenworks) targets it (release v0.22.0, September 20, 2025, is built for NW.js 0.103.1). The download is in the same class as Electron, because it is also a bundled Chromium. I did not measure a current NW.js zip for this plan. The newer JavaScript Steam library, steamworks.js, lists Electron and NW.js both, and its author started it because Greenworks was painful to build. NW.js has a smaller crowd of current examples. It does not buy Petalworks anything Electron lacks.

Valve's own overlay page describes a third path: embed Chromium yourself (they mention CEF), draw it into a Direct3D window, and present a frame every tick. They call that path real work, not a weekend. That is the shape a large studio uses when the overlay must be guaranteed. It is the wrong amount of engineering for this game.

### Steam overlay

Valve's [Steam Overlay](https://partner.steamgames.com/doc/features/overlay) page says the overlay hooks a game launched from Steam and supports DirectX, OpenGL, Metal, and Vulkan. It then answers the question this project actually has:

> My game runs in a browser. Can the Overlay work in that?

Valve's answer: the overlay needs the game to keep presenting full frames. A normal browser updates pieces of the page when they change, and that model does not drive the overlay. The workaround they describe is the embedded-Chromium path above.

So a page on Vercel, and a plain webview that never presents a frame from the app process, should be treated as having no overlay. That includes Tauri on Windows: WebView2 draws in a separate Microsoft process, and Steam's hook has nothing in your process to attach to. People have written about that publicly ([Tauri issue 6196](https://github.com/tauri-apps/tauri/issues/6196), [WebView2 discussion](https://github.com/MicrosoftEdge/WebView2Feedback/discussions/4019)). An unofficial Windows plugin (`tauri-plugin-steam-overlay-surface`) tries to fix it with a decoy window. It is not a Valve feature and not a Tauri feature. I did not verify that it works on Linux or on a Steam Deck. Do not plan the Steam release around it.

steamworks.js tells Electron apps to call `electronEnableSteamOverlay()` after the window is created. That helper is the library's, not Valve's. Treat Shift+Tab as something you test on Windows, on Linux, and on a Deck before the store page mentions the overlay. Achievement toasts use the overlay ([achievements doc](https://partner.steamgames.com/doc/features/achievements)). If Shift+Tab fails, achievements can still unlock on the player's profile, and the in-game toast will not show.

On macOS, overlay support from Catalina onward needs two entitlements in the signed app. They are listed under macOS below.

### Steam Deck, Linux, and Proton

Steam's own platforms are Windows, macOS, and Linux / SteamOS ([Platforms](https://partner.steamgames.com/doc/store/application/platforms)). Steam Deck and Steam Machine are Linux computers with a controller. Valve's [compatibility review](https://partner.steamgames.com/doc/steamhardware/compat) explains the rest:

- A game with a Linux build is reviewed on that build. If the Linux build fails, they try the Windows build under Proton and publish the better result.
- Proton is the Windows-on-Linux layer. A Windows-only upload can run, and it can also fail for a Proton or codec reason and be marked Unsupported. Proton support is still moving.
- The badge (Verified, Playable, Unsupported, Unknown) does not decide whether the game can be bought. It decides how the store describes the experience.
- Verified on Deck means: a default controller setup reaches every part of the game without the player changing settings; on-screen button pictures match the controller that is actually in use; text is readable (no character shorter than 9 pixels at 1280×800; they recommend 12); the game runs at least at 1280×800 or 1280×720; the default settings hold 30 frames per second at 800p; there is no launcher to click through. If the game asks for typed text, the on-screen keyboard has to appear, or the game needs its own controller text entry.

Petalworks should upload a **native Linux build** as well as Windows, so Deck review is not depending on Proton to host a browser. Electron produces that Linux build. Tauri's Linux webview is WebKit, which brings back the audio and canvas risk the deploy notes already call out, and it still has the overlay problem.

The slice does not ask the player to type a name. [ACCESSIBILITY.md](../design/ACCESSIBILITY.md) even says: if a text field is ever added, keyboard handling has to get out of its way. Leave the garden nameless. A text box is what would pull in the on-screen keyboard requirement.

Verified is a later bar, not a launch promise. A mouse-first game with a shipped Steam Input config (trackpad as the mouse, face buttons for place, rotate, undo, and cancel) can reach Playable, and Verified after the glyphs and the default config are honest. The store page should stay quiet about Deck until that review exists. Valve assigns the badge. You can request a review from the app page when the tool is offered to your account. It is not offered to every partner yet.

### macOS signing and notarization

Two separate rules, and both apply:

1. Apple will not open an unsigned app downloaded from the internet without a Gatekeeper warning. Notarization is Apple's check, and it needs a paid Apple Developer account in Allie's name (or the company's). Apple's current guide: [Notarizing macOS software before distribution](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).
2. Steam, since October 14, 2019, requires every new Mac app to be **64-bit and notarized**. In Steamworks you tick "64 Bit Binaries Included" and "App Bundles Are Notarized." Catalina overlay support also needs these entitlements on the build ([Platforms](https://partner.steamgames.com/doc/store/application/platforms)):
   - `com.apple.security.cs.disable-library-validation` (so the Steam library and the overlay library can load)
   - `com.apple.security.cs.allow-dyld-environment-variables` (so the overlay can be injected)

Steam is not compatible with `com.apple.security.app-sandbox`. That entitlement is required for the Mac App Store. Petalworks is not going to the Mac App Store. Leave the sandbox entitlement off the Steam build.

You produce a Mac build (Apple silicon and Intel, or a universal build), sign it with a Developer ID, notarize it, staple the ticket, and upload that build. The same Apple account covers Tauri or Electron. The work is the signing, not the choice of shell. Allie has to own the Apple account. A developer cannot notarize the app with a personal free Apple ID.

Steam's Mac support note still says Intel Macs on OS X 10.11 or later. That line is old relative to Apple's current OS list. Follow the Platforms page in your partner account when you tick supported OS versions, and test the notarized build on a current macOS before you check the box.

### Recommendation

**Use Electron for the Steam build.** Ship Windows, Linux, and macOS from it. Call Steam only from Electron's main process, through steamworks.js, and keep the game code unaware of Steam (section 3).

Tauri remains the right shell for a private icon on Allie's own computer, which is the choice already written in the deploy notes. It is the wrong shell for the Steam SKU: WebKit on the Deck and the Mac, no Node so steamworks.js cannot load, and no overlay unless you adopt an unofficial Windows-only trick.

NW.js and a hand-rolled CEF host are extra projects with the same Chromium download (NW.js) or a much larger engineering job (CEF).

Budget the Steam download at roughly **120–160 MB per OS**, plus a few megabytes of garden. Budget an Apple Developer account and a notarization pass before any Mac customer can launch the game cleanly. Do not put "Steam Overlay" or "Steam Deck Verified" on the store page until you have seen them work.

## 2. Talking to Steam from a web game

Steamworks is a C++ library inside the Steam client. A web game does not call it from Phaser or React. A tiny native layer, in the Electron main process, calls it and forwards a few events to the page. The browser build, the Vercel build, and the itch.io build never load that layer. If Steam is closed, or the page is a normal browser, the game plays and those calls do nothing.

### Libraries

**steamworks.js** ([github.com/ceifa/steamworks.js](https://github.com/ceifa/steamworks.js), npm package `steamworks.js`, version **0.4.0** when checked) is the library to plan on. It is a Node addon with prebuilt binaries and TypeScript types. It covers achievements, stats, cloud files, rich presence, the overlay helper, and Steam Input. You install it. You do not compile the Steam SDK to use it. The author wrote it after using Greenworks, citing an awkward build, missing types, and a callback-heavy API.

It is not an official Valve library, and it is moving slowly. The latest commit GitHub returned for the default branch was September 7, 2025. An open issue from September 2025 asks for new maintainers and was still open, with a comment in August 2026. Open pull requests from 2026 were not on the default branch when this plan was written. Pin the version you install. Read the type declarations that ship with that version before writing calls. The names below are from `client.d.ts` on the default branch on November 1, 2026. An older community wiki still says `stats.storeStats()`; the types on the branch say `stats.store()`.

**Greenworks** ([github.com/greenheartgames/greenworks](https://github.com/greenheartgames/greenworks)) is the older Node addon, still publishing. v0.22.0 shipped September 20, 2025, aimed at NW.js 0.103.1, and the repo had a commit on November 23, 2025. Its own docs still have you rebuild the native addon and drop in a Steamworks SDK folder. steamworks.js's readme calls Greenworks unmaintained. That sentence is the author's reason for starting the new library, and it is behind Greenworks' 2025 releases. Greenworks remains a possible fallback. It is a worse daily driver for a TypeScript Electron app because of the build step.

There is no supported way to call the Steam client from a page hosted on Vercel. Cloud saves and achievements exist only in the Steam copy.

### How a call should sit in this project

- Initialize Steam in the Electron main process. Pass the real app ID there. During development, Steam's shared sample game (app ID 480, Spacewar, which every Steam account owns) is the usual test ID. A `steam_appid.txt` file is a development convenience. Do not ship it in the depot. When a customer launches from Steam, Steam already knows the ID.
- If initialization throws because Steam is not running, start the game anyway.
- Pump callbacks on a timer in the main process (`runCallbacks` in the steamworks.js types). Keep that timer out of the simulation tick.
- The page talks to the main process through one small preload bridge: "unlock this achievement," "write this save string," "set this status line." The simulation never imports the bridge.
- `restartAppIfNecessary` sends a double-clicked exe back through Steam, so the overlay and the cloud sync actually attach. Call it before the window opens.

The library readme also says to copy the Steam redistributable binaries for the target OS into the packaged app (`sdk/redistributable_bin/...`). Follow the readme for the version you pin. Missing those files is a common reason a packaged build fails while `npm start` worked.

### Achievements

Valve's guide is [Stats and Achievements](https://partner.steamgames.com/doc/features/achievements). You create each achievement in the Steamworks app admin (an API name, a player-facing name, a description, an icon) and publish the change. The names can be localized there. The game then:

1. Initializes Steam.
2. Calls the equivalent of `SetAchievement` with the API name when the moment happens.
3. Calls the equivalent of `StoreStats` to upload. Valve says `SetStat` and `SetAchievement` only change memory until `StoreStats`. Steam also tries once more on exit. `StoreStats` can be rate-limited, so call it on the order of minutes, and immediately when an achievement unlocks. The overlay, if it is running, shows the toast.

In the steamworks.js types checked for this plan, that pair is `achievement.activate(name)` and `stats.store()`.

Good first achievements, once the full game or the demo is real, match moments the simulation already announces. They do not need new game rules:

- The first order is packed.
- A daisy travels from a bed to the packing station.
- All six slice orders are packed.
- Later, the Midsummer Crown ships, if that chapter is in the build you are shipping.

Hidden grind achievements fight the tone of the game. A few warm ones are enough. The store page may list achievements only when the build under review unlocks them. Valve's [review process](https://partner.steamgames.com/doc/store/review_process) checks that features named on the page are in the build.

Achievements show on the community profile after the game is publicly visible. They do nothing for a browser player, and the game must not wait on them.

### Steam Cloud saves

Valve's guide is [Steam Cloud](https://partner.steamgames.com/doc/features/cloud). Two mechanisms:

- **Auto-Cloud** watches folders you name on the partner site and syncs matching files when the game starts and when it exits. The game just reads and writes ordinary files. This is the right first integration, because Petalworks already serializes the whole garden to one JSON string (`serialize` in `src/sim/save.ts`).
- **The Cloud API** (`ISteamRemoteStorage`, or steamworks.js `cloud.readFile` / `cloud.writeFile`) is for when you want the game to choose files itself. You do not need it on day one.

Auto-Cloud setup, in plain terms:

- Set a small byte quota and a file count (one save file, maybe one backup). This game's save is tiny. Valve's current write ceiling is 100 MB per `FileWrite` call, which is far above a garden.
- Point a root at the folder the Electron app actually writes. Use the **Cross-Platform** OS setting even though you might upload Windows first. Valve warns that an OS-specific root locks those files to that OS, and they will not sync to a Mac or a Deck later.
- If Windows, Mac, and Linux use different app-data folders, add root overrides so they are one cloud save. The Unity example on Valve's page is the pattern, and it applies to any engine.
- Leave window size, display, and other machine-specific settings out of the cloud file. Valve says this directly. Sound, music, and reduced motion are preferences a player wants on every computer. Those can live in the save. Window bounds stay local.
- Steam writes a `steam_autocloud.vdf` file in each watched folder. The game ignores it.
- Publish the cloud settings. For a game that is already on sale you can limit cloud to developer accounts while testing. An unreleased game has no public owners, so that switch does nothing yet.
- A demo and the full game can share one cloud by setting Shared cloud APP ID. Valve notes that sharing into an unreleased app does not sync, and they do not recommend that setup. A Next Fest garden will not automatically appear inside an unreleased full game. Plan to carry saves over after the full app is released, or accept that the demo save stays on the demo.

Dynamic Cloud Sync matters when someone suspends a Deck and continues on another computer. It is optional. Add it after ordinary Auto-Cloud works, because the game then has to notice that files changed while it was asleep.

### Rich presence

[Enhanced Rich Presence](https://partner.steamgames.com/doc/features/enhancedrichpresence) is the line under a friend's name: what they are doing right now. For a single-player game, Valve's own examples are the chapter, the activity, or "at the main menu." Friend-grouping keys are for people in a party. Petalworks has no party. Skip those keys.

The call is `SetRichPresence`. You set `steam_display` to a localization token you uploaded (for example a line that resolves to "Filling an order" or "Watching the garden"), and you set a short key for which order or chapter is active. The line is one line in the friends list. Long text is cut off.

In the steamworks.js types checked here, the method is `localplayer.setRichPresence(key, value)`.

Test at [steamcommunity.com/dev/testrichpresence](https://steamcommunity.com/dev/testrichpresence) while the Steam client is running. Rich presence is optional. It is a nice friends-list detail after achievements and cloud, not a launch requirement. The API reference for the call is [ISteamFriends.SetRichPresence](https://partner.steamgames.com/doc/api/ISteamFriends#SetRichPresence).

## 3. What the current build should keep true

These are for the lead developer now, while Steam is still months away. They match the brief, the deploy notes, the save code, and [ACCESSIBILITY.md](../design/ACCESSIBILITY.md). None of them add a Steam dependency.

1. **Keep Vite's `base` at `'./'`.** It is already set. An absolute base, or a sprite URL that starts with `/`, breaks itch.io and a packaged window in the same way. Import art through the manifest. The deploy notes' `build.assetsInlineLimit: 0` still belongs in the Vite config before any packaged build, so small sounds are files and not tiny base64 strings. I did not see that limit in `vite.config.ts` when this plan was written.

2. **Keep saves behind `SaveStore`.** `localStorageStore` is the browser implementation. `memoryStore` is the test implementation. The Steam implementation, later, is a third one: write the string from `serialize()` to a single JSON file in the OS app-data folder, and read it back through `deserialize()`. Auto-Cloud will watch that file. Do not call Steam, `localStorage`, or `window` from `src/sim`. The shell picks the store.

3. **Keep `SAVE_VERSION` and the migration function.** A cloud file is the same JSON a browser save is. A future schema bump has to load a garden that was saved on a phone browser and later copied into the desktop file, and the other way around, if you ever offer an export. `savedAt` uses the wall clock. That is fine as a label. The simulation must not read it. Seasons and weather in the roadmap are chapter state, not the computer's date.

4. **Split machine settings out of the cloud file when you add the file store.** Sound, music, reduced motion, and tutorial progress can travel. Window size and position stay in a local file the cloud ignores. Valve's cloud guide asks for this so a Deck and a desktop monitor do not fight over a resolution.

5. **Treat browser-only APIs as optional.** The audio unlock on the first click stays (browsers and itch.io require the gesture; Chromium inside Electron is looser, and the same code is fine). Keep the Ogg-versus-MP3 probe from the deploy notes so a WebKit shell still has sound. Skip a service worker, as the deploy notes already say. Do not add a `<input>` for a garden name. Do not pointer-lock the mouse. A Deck trackpad mapped to a mouse needs a free cursor. If a link to a website is ever added, open it through one function the shell can replace. The store page itself is not allowed to link out (section 6).

6. **Make the window fit 1280×800 without a browser toolbar.** [ACCESSIBILITY.md](../design/ACCESSIBILITY.md) already sets that size as the minimum, with 16 px body text (14 px only on two footer lines), 44 px hit targets, and a default camera fit that keeps tiles at least 48 CSS pixels. Those numbers clear Steam Deck's text floor (9 px minimum, 12 px recommended at 1280×800). The catch: the accessibility plan also leans on browser zoom. A Steam window has no browser zoom control unless you build one. The fit rule has to run when the Electron window is resized, not only when a browser changes zoom. The 16×12 board at 64 px is 1024×768 before the top bar. The later 20×14 plot is 1280×896, which is taller than a Deck. Default zoom fits the open garden, and pan and zoom still work. The window is resizable. Avoid a fixed pixel canvas and `overflow: hidden` on the order text.

7. **Keep every action on a button as well as a key.** The accessibility plan already binds place, rotate, undo, cancel, pause, and speed to keys and to visible controls, and it keeps pointer drag for belts. That is what a Steam Input config needs: it can send those keys from a Deck button, and it can send mouse movement from a trackpad. Hover-only tips cannot be the only place a cost or a status is written. The inspector already has the words. When a controller is the active device, the How to Play page should show those buttons, not a row of keyboard letters. Valve fails the glyph check when a Deck player sees keyboard prompts. Doing the glyph swap can wait until the Steam shell exists. Making sure no action is key-only cannot wait, because it is expensive to unwind later.

8. **Leave Steam feature flags as no-ops in the web build.** A single module such as `steam.ts` in the shell, with empty functions for unlock, cloud, and presence, gives the lead a place to call "order completed" without importing a native addon. The web build ships the empty functions. The Electron build replaces them. The store page stays honest because the web game never pretends to have cloud saves. The title-screen line already says the garden is saved on this device. Keep that line in the browser build.

## 4. Opening a Steamworks account

Start at [Steam Direct](https://partner.steamgames.com/steamdirect). You sign in with a Steam account. That account becomes the person Valve does business with. Use a real Steam account Allie controls, not a throwaway, because the fee sticks to the account that paid it.

The steps, from [Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding) and the Steam Direct page:

1. **Sign the digital paperwork.** That includes the NDA and the Steam Distribution Agreement. Have the legal name of the person or company that owns the game. A sole proprietorship is allowed: company type "Sole Proprietorship," and the company name is your legal first and last name. Do not enter a nickname, a studio pen name, or a "doing business as" name. The name has to match the bank account and the tax documents.

2. **Pay the app fee.** $100 USD or the local equivalent, **per product**, through the Steam store, with any payment method Steam supports in your country. Steam Wallet funds cannot be used. Details are in section 5.

3. **Bank account.** Routing number, account number, and bank address, so Valve can pay sales. The name on the bank account must match the legal name from step 1. If the business does not have an account yet, open one before this step. A personal account is fine when you are onboarding as that person.

4. **Tax.** A short questionnaire. US persons need information like a W-9. People in a country with a US tax treaty need information like a W-8BEN. After you submit, a third party checks it. Valve says this can take **up to 30 days**, they may ask for more documents by email, and you cannot edit the tax info while the check is running. Watch spam folders.

5. **Identity.** Valve's [identification documents](https://partner.steamgames.com/doc/gettingstarted/documents) page says many checks are a photo of you holding the same legal ID you already sent. Your whole face has to be visible, hats and glasses off unless they are on the ID, the ID readable, all four corners in frame, sent as a JPEG. The Steam Direct page describes the bank, tax, and identity block as taking **15–30 days**, and says you have Steamworks access after that.

The content rules on those same pages are easy for this game to meet. Steam is not accepting ad-supported business models, malware, or games you do not have the rights to. Petalworks has no ads, no account, and no login. Keep it that way in the Steam build. Commissioned art and music need a license that covers selling the game. That is a paperwork item for Allie, separate from Valve's forms.

The share of each sale that Valve keeps is in the Steam Distribution Agreement you sign during this paperwork. I did not find a percentage stated on the public onboarding or fee pages, so this plan does not quote one.

## 5. Can you pay before the game exists?

**Yes.** You can pay now, get an app credit, and turn that credit into a Petalworks app ID before a build exists. You can put up a Coming Soon page after the store page is approved, and upload the playable build later. Valve's public docs do not state a deadline for that upload, and they do not state an expiration date on the credit.

What the docs do say:

- The fee is **$100 USD (or equivalent) for each new app** you want to distribute ([Steam Direct Fee](https://partner.steamgames.com/doc/gettingstarted/appfee)). One game, one fee. A second product is another $100.
- Paying attaches an **app credit** to the Steam account of the person who paid. Only that person can activate it. On an existing partner account, only an admin sees the button. For a first signup, the fee is one of the onboarding steps, and you are sent to the Steam store to pay, then back to Steamworks.
- You create the app from the Steamworks home page with "Create new app..." after the fee is paid or a credit is granted ([Applications](https://partner.steamgames.com/doc/store/application)). That click is what reserves the app ID. Nothing on that page requires a depot or a build.
- The fee is **not refundable**. It is **recoupable** in the payment for the month after that product has at least **$1,000.00 adjusted gross revenue** from Steam store sales or in-app purchases. The recoupment is its own line on the monthly report. If the $100 payment is charged back or marked fraudulent, Valve can hold both the sales payout and the fee repayment. Valve may add VAT, GST, or a similar tax on the $100, by country. The invoice is issued to the **person** logged in, not to a company, and Valve will not write a second invoice. If Allie pays on behalf of a company, the practical path they describe is an expense report. Ask a tax advisor for the local treatment.
- [Coming Soon](https://partner.steamgames.com/doc/store/coming_soon): you can post a page well before release. You need branding, a written description, and ideally a gameplay trailer. The same page says you can post once you have branding, screenshots, and a description. Creating the app, finishing the store checklist, and passing review come before the public page. Submit the review at least **7 business days** before you want the page live. After approval you press "Post as Coming Soon" yourself.
- [Release Process](https://partner.steamgames.com/doc/store/releasing): the store checklist and the build checklist are separate. The store page has to be submitted before the build can be submitted. The build you eventually upload should contain what the store page claims. It does not have to be the last build you will ever ship. You can keep updating it during and after review.
- I read the fee page, the onboarding page, the applications page, the Coming Soon page, and the release process page for an upload deadline or a "credit expires" rule. **None of them state one.** The credit can sit unused. The $100 is still gone if you never release.

What "pay now" does not skip:

- Identity, tax, and bank verification. The Steam Direct page puts Steamworks access after that 15–30 day block. Paying is part of signup. It does not mean the app ID exists the same afternoon.
- A Coming Soon page still needs real pictures of the game. Screenshots have to be gameplay, not concept art (section 6). Interim programmer art should not be the public face of the game. Valve also says to wait until you are confident in the art direction and the core features, because people who wishlist an early version can be confused if the game changes shape. There is, in their words, no strong downside to a page that stays up a long time when the game stays recognizable. Wishlists from two years out convert about as well as wishlists from two weeks out, on their account.
- The trailer doc says a trailer is required as part of release ([Trailers](https://partner.steamgames.com/doc/store/trailer)). The Coming Soon page calls a gameplay trailer ideal, and says branding, screenshots, and a description are enough to post. The checklist inside your app admin is the list that actually unlocks the button. I could not see that logged-in checklist. Treat the trailer as required for the public launch, and have it ready for the Coming Soon review if the checklist asks for it. Seven business days is the buffer they ask for.

Waiting periods that do exist, all of them about **release**, not about uploading:

| Rule | Where it is written | What it gates |
| --- | --- | --- |
| 21 days after you pay the fee, for your first few titles | [Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding) | Pressing Release |
| 30 days after you pay the fee, for your first few titles | [Steam Direct](https://partner.steamgames.com/steamdirect) landing page | Pressing Release |
| Bank, tax, and identity: 15–30 days | Steam Direct landing page | Getting into Steamworks |
| Tax check: up to 30 days | Onboarding | Editing tax info |
| Store review: typically 3–5 business days; submit at least 7 business days ahead | [Review process](https://partner.steamgames.com/doc/store/review_process) and Coming Soon | The page going public |
| Build review: typically 3–5 business days; plan at least 7 | Review process and Release process | The game being allowed to release |
| Coming Soon visible for at least two weeks | Onboarding, Coming Soon, Release process | Pressing Release |
| A "perfect" pair of reviews still takes about a week; give yourself 3–4 weeks | Valve's [Preparing for Release](https://steamcdn-a.akamaihd.net/steamcommunity/public/images/steamworks_docs/english/PreparingForLaunch_2025.pdf) talk notes | Sanity margin, not a rule |

The 21-day and 30-day figures are both on official Valve pages, and they contradict each other. The onboarding doc is the one linked from the Steamworks documentation. The Steam Direct landing page still says 30. **Plan on 30 days from payment to the earliest release**, and expect identity and tax to be the longer pole if you start from zero. If you pay in November 2026 and release in 2027, that wait will already have passed. It does not force you to ship.

A separate note from [Release Options](https://partner.steamgames.com/doc/store/types): once the Coming Soon page is live and the release date is inside 14 days, you cannot move that date without contacting Valve. Set a season or a rough window until the date is real. You can change the date before that 14-day window. Valve would rather you move an honest date than miss a specific one.

Demos are created with "Add Demo" on the base game, not with the "Create new app" button that spends a credit ([Demos](https://partner.steamgames.com/doc/store/application/demos)). I could not find a sentence that says a demo costs another $100, or that it is free. Confirm the charge on screen before you click Add Demo. Do not buy a second credit "just in case" until you know.

## 6. Store page checklist, in this game's clothes

Capsules are the posters. Screenshots and the trailer are the game. Valve's asset rules: every capsule has a readable product name and the right pixel size, and the artwork stays at a PG-13 level, which this garden does ([Graphical Asset Rules](https://partner.steamgames.com/doc/store/assets/rules)). Store capsules updated in August 2024. Old sizes are refused. Use the templates linked from [Graphical Assets](https://partner.steamgames.com/doc/store/assets).

Art direction for every image: the storybook gouache from the brief. Cream `#F6EBD5`, sage, moss, petal pink, lavender, honey, ink `#39463B`. True top-down. Light from the top-left. A working garden: wooden beds, cream canvas belts, a daisy or a lavender sprig on a belt, the bundling table, the packing crate, hedge border. No character, because the player is not a character. No glossy mobile-game look, no neon, no mock "Wishlist" button, no review quotes, no awards, no "Coming 2027" baked into the picture. Extra words get the capsule rejected. The name **Petalworks** is the only text on the store capsules, painted so it survives being shrunk, ink with a honey edge, on a quiet patch of cream so it stays legible.

| Asset | Size | Required | What to paint |
| --- | --- | --- | --- |
| Header capsule | 920×430 | Yes | Garden plus the name. Used at the top of the store page. |
| Small capsule | 462×174 | Yes | The name nearly fills the frame. Steam also makes 184×69 and 120×45 from this file. A busy garden with a small wordmark will fail at 120 px wide. A daisy beside the word is enough. |
| Main capsule | 1232×706 | Yes | The wide key art, including the front-page carousel. Garden in motion, name readable. |
| Vertical capsule | 748×896 | Yes | The tall poster for sale pages. Name at the top or bottom, garden stacked underneath. |
| Library capsule | 600×900 | Yes | Tall library poster. Name required. A subtitle is allowed on this one asset only, if you want "A cozy flower workshop." No other words. |
| Library hero | 3840×1240 PNG | Yes | Garden only. **No text at all.** Keep the important flowers and one machine inside the center safe area of 860×380. Let hedges bleed to the edges. Steam also makes a 1920×620 copy. |
| Library logo | 1280 px wide, or 720 px tall, or both; PNG | Yes | The word Petalworks only, transparent background. No garden. You place it over the hero in Steam's preview (bottom-left, or centered). |
| Library header capsule | 920×430 | Yes | Same job as the store header, uploaded again for the library. |
| Screenshots | At least 5, each at least 1920×1080, 16:9 | Yes | Gameplay only. See the list below. |
| Trailer | Up to 1920×1080, 16:9 preferred | Required for release; called ideal for Coming Soon | Real play. Specs below. |
| Page background | 1438×810 | Optional | Pale cream paper, very quiet, so store text stays readable. |
| Shortcut icon | 256×256 or 512×512 PNG (Steam can build the .ico) | Yes | A single daisy or a letter P, readable at a tiny size. Also upload an **ICNS** in the Mac icon slot, or Mac shortcuts show the Steam logo. |
| App icon | 184×184 JPG | Yes | Square, no transparency. Alpha is replaced with black. Paint a cream background into the file. |

Screenshot rules, from [Store Graphical Assets](https://partner.steamgames.com/doc/store/assets/standard): gameplay only. Concept art, cinematic stills, awards, and marketing sentences are rejected. The HUD is welcome, because it shows how the game is played. Mark at least four screenshots as suitable for all ages. This game's shots all qualify. If none are marked, Steam hides them in some places, including the front-page hover.

A useful set, once the gouache is in the engine:

1. A new garden, one daisy bed, a short belt, the packing station, Nell's order visible.
2. A daisy actually sitting on a belt, mid-garden. This is the picture that explains the game.
3. The bundling table working, twine and a bundle readable.
4. Two chains at once, daisies and lavender, so the screenshot shows "more than one recipe."
5. A mixed bouquet arriving, the order card showing progress.
6. Optional: a fuller sandbox layout after the sixth order, still top-down, still the real UI.

Take them at 1920×1080 or larger from the running game, not from a painting app. The accessibility colors (ink on cream) will read better in a thumbnail than cream-on-coral badges. Capture after that HUD treatment is in, if the timing works.

Trailer, from [Trailers](https://partner.steamgames.com/doc/store/trailer): one gameplay trailer, about 30 to 60 seconds. Place a bed, drag a belt, wait for a flower to move, complete an order. Calm cuts. The player's view, not a flyover painting. Upload the highest resolution you have, up to 1920×1080, at 30 or 60 fps (29.97 and 59.94 are also accepted), at least 5,000 Kbps, in `.mp4`, `.mov`, or `.wmv`. H.264 video and AAC audio are preferred. Audio is mixed down to stereo. Steam makes a 600×380 poster and a 232×130 thumbnail. A custom poster has to be a **frame from that video**, 1920×1080 JPG or PNG, and it should avoid extra text.

**Short description.** Plain text, one paragraph, a few hundred characters. Valve's [description guide](https://partner.steamgames.com/doc/store/page/description) does not print an exact cap. The partner editor is widely reported to stop at 300. I could not confirm 300 on an official page. No line breaks, no bullets, no dates, no "now available," no links. A draft, 214 characters, for Allie to edit:

> Build a tiny flower workshop. Grow daisies and lavender, send them down painted conveyor belts, and bundle them into orders for the neighbors. A cozy automation game about watching a garden you designed run itself.

**About this game.** Short headed bits, not a wall of text. What you do (place beds and belts, fill orders, watch the garden run). What the pace is (no timers, no fail state, orders wait). That there is no character to walk around. If the launch build is the full meadow, describe the Midsummer Showing. If a chapter is not in the launch build, say it is later, in words, or leave it out. Valve rejects pages that present unfinished features as present. Embedded images in this section should each be under 5 MB, and all of them together under 15 MB. No links, no QR codes, no fake Steam buttons, no ads for other games. Social links, if you want them, go in the specific fields on the Basic Info tab.

**Tags.** At least 5 before launch. Up to 20 are visible and affect where Steam shows the game. The top 5 should describe it on their own. Set them with the Tag Wizard, and confirm each name is really in the list. A sensible weight order to try:

1. Automation
2. Relaxing
3. Casual
4. Simulation
5. Resource Management

Then, if the wizard offers them: Building, 2D, Top-Down, Singleplayer, Colorful, Cute, Management, Puzzle, Indie. Add Cozy if it is offered, near the top. Leave off Idle, Clicker, Survival, Horror, and Multiplayer. Players can add tags later. You can remove ones that are wrong.

Also on the page: one player, English (American spelling, matching the game), supported systems only for builds you actually upload, and a content survey that matches a gentle garden. Pricing is something you enter yourself before release. This plan does not pick a price.

## 7. Order of work

Today is November 1, 2026. The slice is still in progress. Steam does not need to interrupt it.

**Now, in parallel with the slice**

- Lead developer follows section 3. No wrapper yet.
- Allie can start Steamworks signup: legal name, bank, tax, photo ID. This is the long pole, and it does not need a build.
- Pay the $100 when the signup flow asks, if you are comfortable spending a non-refundable fee to hold an app ID. You can also wait until the painted game is ready to show. Waiting does not violate any rule I could find. Paying early only helps if you want the tools, or you want the 21/30-day clock already finished before a release date you care about.
- Do not make capsules from interim art.

**When the gouache garden is on screen and the six orders are playable**

- Create the app if the credit is not used yet.
- Shoot the five screenshots and the trailer from that build.
- Paint the capsules around those shots, name legible at small size.
- Write the short description and the about text so they describe the product you intend to sell. The full workshop in [PROGRESSION_ROADMAP.md](../design/PROGRESSION_ROADMAP.md) is that product. The six-order garden is the demo of it.
- Submit the store page. Give Valve a week. Fix what they send back. Press Coming Soon.
- Point people at that page. That is the wishlist button.

**When you are ready for a Next Fest, or for a public demo**

- Add a demo app from the base game. Upload the six-order build in the Electron shell, after it feels finished rather than provisional. Valve's demo advice: quality matters, because people are deciding whether to buy, and the demo should leave them wanting the rest. A polished teaching garden does that. A build with stand-in art does not.
- Register from the **base game**, not from the demo. See the Next Fest note below.

**When the version you want to sell is feature-complete**

- Package Electron for Windows, Linux, and Mac. Notarize the Mac build. Copy in the Steam redistributables. Confirm a double-clicked exe relaunches through Steam.
- Hook Auto-Cloud to the one save file. Unlock one achievement and see it on a test profile. Set one rich-presence line. Test Shift+Tab.
- Play at 1280×800 with a controller config that can finish an order.
- Submit the **build** review only after the store page is in review. Plan a week, and leave another week for a rejection.
- Check the fee-date rule (30 days if you want to be safe) and the two-week Coming Soon rule.
- You press Release yourself. An approved game does not go live on its own ([Release process](https://partner.steamgames.com/doc/store/releasing)).

If the full meadow is not ready and you still want to charge for the six-order garden, release as Early Access and fill in Valve's Early Access questions so the page says what is in the build and what is still coming. Early Access still needs the two-week Coming Soon page ([Release options](https://partner.steamgames.com/doc/store/types)). A quiet full release of a 30-minute slice, described as the whole game, is the outcome to avoid.

A rough sequence, not a calendar promise:

1. Signup and fee (can start this week).
2. Painted slice, then store assets.
3. Store review, then Coming Soon and wishlists.
4. Electron shell, cloud, one achievement, overlay test.
5. Optional Next Fest demo.
6. Build review of the version you are selling.
7. Release, after Coming Soon has been up two weeks and the fee wait has passed.

## Wishlists and Next Fest

**Wishlists.** Once the Coming Soon page is public, anyone can wishlist the game. You do not write any Steam code for that. When you release, or when you discount, Steam emails the people who wishlisted, subject to their email settings. Someone who was emailed about this app in the last two weeks is skipped until that cooldown passes. The cooldown can run longer during big sales ([Wishlists](https://partner.steamgames.com/doc/marketing/wishlist)).

You also get **one** button to tell wishlisters that a free demo is out. You choose the moment, and it has to be within two weeks of the demo becoming public. It is easy to waste that notice on a broken upload. Send it when the demo is something you would hand a friend.

Valve's Coming Soon page is explicit that a long wishlist period is fine when the game people wishlisted is the game you release.

**Next Fest.** October 2026 already happened (October 19–26, 2026). The next one is **February 22 to March 1, 2027**, 10:00 AM PST to 10:00 AM PST ([February 2027 edition](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027)). The general rules are on the [Next Fest parent page](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest).

You can join if all of these are true:

- The Steamworks account is in good standing.
- The base game's store page is already public.
- The game is not a prologue or a demo of something already on Steam.
- A public demo is playable when the fest starts.
- The game itself releases **after** the fest ends (after March 1, 2027, for this edition).
- This game has never been in a Next Fest. **One fest per game, ever.** The February page says the following edition is June 2027. It does not list June's dates.

Dates that matter if you want February 2027:

| When | What |
| --- | --- |
| December 8, 2026, 10–11 AM PST | Valve's live Q&A |
| January 10, 2027, 11:59 PM PST | Registration deadline. Have the marketing materials current if you want a chance at the official trailer. |
| January 18, 2027 | Trailer pull for the official fest trailer. Also the day by which a demo must be **submitted** if you want it in the press preview. |
| February 1, 2027 | Everything required must be submitted for review. |
| February 11, 2027, 10 AM PST | Press preview starts. Last day to opt out of trailer use. |
| February 22, 2027, 10 AM PST | Fest starts. The demo has to be live before this. |
| March 1, 2027 | Fest ends. The full game must release after this if you took part. |

The parent page's standing buffers, if a later fest uses the same shape: submit the demo about **5 weeks** before the fest for the press preview, and no later than **3 weeks** before the fest to be in the fest at all. Review only checks that the demo runs and that it has the features you promised. It is not a bug hunt. You can patch after you pass, and that patch is not re-reviewed, so test it yourself.

February 2027 is realistic only if a store page can be public in December or early January and a polished six-order demo can be submitted by February 1. If the art will still be interim then, skip February. You only get one fest. June 2027 is the next one named in the docs, and its dates were not published on the February page when this was written.

## What I could not verify

- A single number for the first-title wait. Onboarding says 21 days. The Steam Direct landing page says 30. Both were live on November 1, 2026.
- Any deadline, or any absence of a deadline beyond "I could not find one," for uploading a build after the fee. The pages listed in section 5 do not mention one.
- Whether Add Demo charges another $100. The button is different from the one that spends an app credit. The fee page says "each new app."
- The exact short-description character cap. Valve says "a few hundred characters."
- Valve's revenue share percentage, which sits in the agreement rather than on the public fee page.
- That `electronEnableSteamOverlay()` succeeds on Linux and on a Deck. Valve's overlay FAQ describes a harder embedding path and does not mention that helper. Test it.
- That the unofficial Tauri overlay plugin works anywhere. I did not treat it as an option.
- A current NW.js download size.
- June 2027 Next Fest dates. Only the month is named.
- The logged-in store checklist, which may require a trailer before Coming Soon even though the public Coming Soon page calls the trailer ideal.
- Steam's supported macOS version list beyond the Platforms page, which still mentions OS X 10.11. Re-read that page when you tick boxes.

## Sources

Steamworks:

- [Steam Direct](https://partner.steamgames.com/steamdirect)
- [Onboarding](https://partner.steamgames.com/doc/gettingstarted/onboarding)
- [Identification documents](https://partner.steamgames.com/doc/gettingstarted/documents)
- [Steam Direct Fee](https://partner.steamgames.com/doc/gettingstarted/appfee)
- [Applications](https://partner.steamgames.com/doc/store/application)
- [Coming Soon](https://partner.steamgames.com/doc/store/coming_soon)
- [Release process](https://partner.steamgames.com/doc/store/releasing)
- [Release options](https://partner.steamgames.com/doc/store/types)
- [Review process](https://partner.steamgames.com/doc/store/review_process)
- [Preparing for Release (2025 talk notes, PDF)](https://steamcdn-a.akamaihd.net/steamcommunity/public/images/steamworks_docs/english/PreparingForLaunch_2025.pdf)
- [Platforms, including macOS notarization and entitlements](https://partner.steamgames.com/doc/store/application/platforms)
- [Steam Overlay](https://partner.steamgames.com/doc/features/overlay)
- [Steam Deck and Steam Machine compatibility](https://partner.steamgames.com/doc/steamhardware/compat)
- [Getting your game ready for Steam Deck and Steam Machine](https://partner.steamgames.com/doc/steamhardware/recommendations)
- [Stats and Achievements](https://partner.steamgames.com/doc/features/achievements)
- [Steam Cloud](https://partner.steamgames.com/doc/features/cloud)
- [Enhanced Rich Presence](https://partner.steamgames.com/doc/features/enhancedrichpresence)
- [Graphical assets overview](https://partner.steamgames.com/doc/store/assets)
- [Store graphical assets](https://partner.steamgames.com/doc/store/assets/standard)
- [Library assets](https://partner.steamgames.com/doc/store/assets/libraryassets)
- [Graphical asset rules](https://partner.steamgames.com/doc/store/assets/rules)
- [Community and client icons](https://partner.steamgames.com/doc/store/assets/community)
- [Trailers](https://partner.steamgames.com/doc/store/trailer)
- [Written description](https://partner.steamgames.com/doc/store/page/description)
- [Tags](https://partner.steamgames.com/doc/store/tags)
- [Demos](https://partner.steamgames.com/doc/store/application/demos)
- [Wishlists](https://partner.steamgames.com/doc/marketing/wishlist)
- [Steam Next Fest](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest)
- [Steam Next Fest: February 2027](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/feb_2027)
- [Steam Next Fest: October 2026](https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest/2026october) (already over; cited for the calendar)

Tools:

- [Electron application distribution](https://www.electronjs.org/docs/latest/tutorial/application-distribution)
- [Electron 45.2.1 release](https://github.com/electron/electron/releases/tag/v45.2.1) (zip sizes)
- [Electron Packager](https://electron.github.io/packager/main/)
- [Tauri 2 start](https://v2.tauri.app/start/) and [app size](https://v2.tauri.app/concept/size/)
- [Tauri Vite guide](https://v2.tauri.app/start/frontend/vite/)
- [steamworks.js](https://github.com/ceifa/steamworks.js) (`client.d.ts` and `index.d.ts` on the default branch)
- [Greenworks](https://github.com/greenheartgames/greenworks)
- [Apple notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution)

In this repo: [DEPLOY_AND_PACKAGING.md](DEPLOY_AND_PACKAGING.md), [BRIEF.md](../BRIEF.md), [ASSET_SPECS.md](../ASSET_SPECS.md), [ACCESSIBILITY.md](../design/ACCESSIBILITY.md), [PROGRESSION_ROADMAP.md](../design/PROGRESSION_ROADMAP.md), `vite.config.ts` (`base: './'`), `src/sim/save.ts` (`SaveStore`, `SAVE_VERSION`).
