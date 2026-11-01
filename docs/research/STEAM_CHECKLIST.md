# Steam checklist for Petalworks

The reasoning and the source links live in [STEAM_PLAN.md](STEAM_PLAN.md). This is the punch list. Checked against public docs on November 1, 2026.

## While the browser game is still being built

- [ ] Leave Vite `base` at `'./'`.
- [ ] Set `build.assetsInlineLimit` to `0` before any packaged build.
- [ ] Keep saves behind `SaveStore`. Browser uses `localStorageStore`. A later Steam build writes one JSON file.
- [ ] Keep `SAVE_VERSION` and migrations. The sim does not read `savedAt`.
- [ ] Keep Steam, `localStorage`, and `window` out of `src/sim`.
- [ ] Keep the Ogg-or-MP3 probe. Skip a service worker.
- [ ] Window fit works at 1280×800 inside the page, with tiles at least 48 CSS px. Resizing the window refits the garden. Do not rely on browser-chrome zoom.
- [ ] Body text stays at least 16 px (14 px only on the two footer lines already in the accessibility plan).
- [ ] Every action has a visible button, not only a key. No hover-only costs or status. No mouse pointer-lock. No garden-name text field.
- [ ] A no-op Steam bridge exists in the shell so "order completed" has somewhere to go later.

## Account and fee

- [ ] Steamworks signup uses Allie's real Steam account and legal name. Bank account name matches. Sole prop is fine. No nickname or DBA in the legal name.
- [ ] Tax questionnaire submitted. Inbox watched for up to 30 days, including spam.
- [ ] Identity photo: full face, same ID, four corners, JPEG, no hat or glasses unless the ID shows them.
- [ ] $100 fee paid (plus any VAT or GST the store adds). Invoice will be in the person's name.
- [ ] App created with "Create new app..." so the app ID exists. No build required to do this.
- [ ] The person who paid is the person who clicks Create. Only they can spend the credit.

There is no published deadline to upload a build after this payment. The fee is not refunded if you never ship. It comes back as a line item after this game reaches $1,000 adjusted gross revenue.

## Store page, before Coming Soon

Capsules: name plus gouache garden. Store capsules have no extra words. Hero has no words at all.

- [ ] Header capsule, 920×430.
- [ ] Small capsule, 462×174, name large enough to read at 120×45.
- [ ] Main capsule, 1232×706.
- [ ] Vertical capsule, 748×896.
- [ ] Library capsule, 600×900.
- [ ] Library hero, 3840×1240 PNG, no text, subject inside the 860×380 center.
- [ ] Library logo, transparent PNG, 1280 wide and/or 720 tall, wordmark only.
- [ ] Library header capsule, 920×430.
- [ ] At least five gameplay screenshots, 1920×1080 or larger, 16:9. At least four marked suitable for all ages.
- [ ] Gameplay trailer, up to 1920×1080, 16:9, 30 or 60 fps, 5,000+ Kbps, H.264 and AAC. Custom poster is a frame from that video.
- [ ] Shortcut icon, 256 or 512 PNG, plus a Mac ICNS.
- [ ] App icon, 184×184 JPG, background painted in (no transparency).
- [ ] Short description, plain text, a few hundred characters, no date and no link.
- [ ] About text matches the build you will actually sell. Later chapters are labeled as later, or left out.
- [ ] At least five tags in the Tag Wizard. Top five describe the game. Confirm Cozy, Automation, Relaxing, Casual, Simulation, and Resource Management exist before you rely on those names.
- [ ] Store page submitted at least 7 business days before you want it public.
- [ ] After approval, press "Post as Coming Soon." Leave the release date vague until it is inside a window you can hit. Inside 14 days, changing it means writing to Valve.

## Desktop build, before release review

- [ ] Electron app for Windows, Linux, and macOS, loading the same `dist` with a relative base.
- [ ] Mac build signed, notarized, and stapled. Steam boxes ticked: 64-bit, notarized. Overlay entitlements on. App Sandbox entitlement off.
- [ ] steamworks.js pinned. Steam redistributables copied into the package. `steam_appid.txt` not shipped.
- [ ] Double-clicking the exe relaunches through Steam.
- [ ] Shift+Tab tested on Windows and on Linux before the page mentions the overlay.
- [ ] One save file in the app-data folder. Auto-Cloud root is Cross-Platform. Window size is not in that file.
- [ ] One achievement unlocks in a test account, then `stats.store()` (or whatever the pinned types call it) runs.
- [ ] Rich presence shows one short line. Test on the Steam rich-presence page.
- [ ] A default controller layout can finish an order at 1280×800. Deck Verified is not claimed until Valve says so.
- [ ] Store page submitted before the build is submitted. Build contains every feature the page lists.
- [ ] Plan a week for build review. For a first release, also wait 30 days from the fee payment (the docs disagree between 21 and 30) and two weeks of public Coming Soon.
- [ ] You press Release. Steam will not press it for you.

## Next Fest and wishlists

October 2026 is over. The next fest is February 22–March 1, 2027. One fest per game.

- [ ] Coming Soon page is public before you register.
- [ ] Register the base game by January 10, 2027, 11:59 PM PST, if you want February.
- [ ] Demo build submitted by February 1, 2027 (January 18 if you want the press preview).
- [ ] Demo set live before February 22, 2027, 10:00 AM PST.
- [ ] Full game releases after March 1, 2027.
- [ ] If the art will not be store-ready by early January, skip February and keep the one shot for a later fest.
- [ ] Wishlist link is the store page. Send the one-time "demo is out" email only after the demo is actually good, within two weeks of it going public.
