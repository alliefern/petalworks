# Petalworks accessibility (slice)

A build plan for the first-pass slice. The player can tell items, beds, and machine states apart without relying on color, can play the garden from the keyboard, can quiet extra motion, and can mute sound without losing that choice on reload.

Scope is the slice in the brief: the 16×12 garden, six orders, the HUD, the build menu, the inspector, and the cues in `assets/audio/AUDIO_MANIFEST.md`. Anything past that is marked **Post-slice**.

Player-facing words already live in `docs/content/COPY.md`. Use those keys. Status is never color alone (`COPY.md`, Status labels). This file says how to draw and bind the rest.

Targets, WCAG 2.1 AA:

- Body text: **4.5:1** (SC 1.4.3).
- Large text (18px regular, or 14px bold): **3:1**.
- UI boundaries and state graphics: **3:1** against the adjacent color (SC 1.4.11).

## How the ratios were computed

Palette from `docs/BRIEF.md` and `docs/ASSET_SPECS.md`:

| Token | Hex | Relative luminance |
| --- | --- | --- |
| cream | `#F6EBD5` | 0.838 |
| sage | `#A8B99A` | 0.454 |
| moss | `#657C58` | 0.179 |
| petal pink | `#E9A8AF` | 0.484 |
| coral | `#D77F70` | 0.308 |
| lavender | `#B7A4CE` | 0.411 |
| honey | `#DDB66C` | 0.499 |
| ink | `#39463B` | 0.056 |

WCAG 2.x relative luminance. sRGB channels are linearized (`c/12.92` at or below 0.04045, otherwise `((c+0.055)/1.055)^2.4`), then `L = 0.2126 R + 0.7152 G + 0.0722 B`. Contrast is `(Llighter + 0.05) / (Ldarker + 0.05)`, rounded to two decimals. Grass in the ratios below is sage `#A8B99A`. Belt canvas is cream `#F6EBD5` (the spec calls it a pale cream strip).

## 1. Telling states apart without color

### Text and the top bar

Put readable text in the React HUD, in Nunito (already in `src/ui/fonts`). The top bar, order card, inspector, settings, errors, and coach marks use **ink `#39463B` on cream `#F6EBD5`**.

| Pairing | Ratio | Body text (4.5:1) | Graphics (3:1) | Use |
| --- | --- | --- | --- | --- |
| Ink on cream | **8.41:1** | Pass | Pass | Top bar, order, inspector, settings, errors, coach marks, badge glyphs |
| Ink on sage | **4.77:1** | Pass | Pass | Ink stroke sitting on grass |
| Ink on honey | **5.20:1** | Pass | Pass | Ink glyph if it ever sits on a honey fill |
| Ink on petal | **5.06:1** | Pass | Pass | Ink stroke on a pink petal |
| Ink on lavender | **4.36:1** | Fail | Pass | Too close for a word. Fine for a thick stroke. |
| Cream on moss | **3.88:1** | Fail | Pass | Large text only. Too low for the order sentence. |
| Ink on coral | **3.39:1** | Fail | Pass | A bold symbol can sit here. A sentence cannot. |
| Ink on moss | **2.17:1** | Fail | Fail | Unusable. Moss is a fill, never a text background. |
| Cream on coral | **2.48:1** | Fail | Fail | The spec's cream "!" and "×" on the coral pennant |
| Cream on lavender | **1.93:1** | Fail | Fail | The spec's cream "…" on the lavender pennant |
| Cream on sage | **1.76:1** | Fail | Fail | Cream words on a sage panel, or on grass |
| Cream on petal | **1.66:1** | Fail | Fail | |
| Cream on honey | **1.62:1** | Fail | Fail | The spec's cream check on the honey pennant |
| Sage on cream | **1.76:1** | Fail | Fail | Sage chevrons on the cream belt |
| Coral on sage | **1.41:1** | Fail | Fail | Coral pennant or invalid ring on grass |
| Moss on sage | **2.20:1** | Fail | Fail | A darker grass tile against the lawn |
| Honey on sage | **1.09:1** | Fail | Fail | Honey ready pennant or select ring on grass |
| Lavender on sage | **1.09:1** | Fail | Fail | Lavender waiting pennant, or a sprig, on grass |
| Petal on sage | **1.06:1** | Fail | Fail | |
| Coral on honey | **1.53:1** | Fail | Fail | Blocked pennant against the ready pennant |
| Honey on cream | **1.62:1** | Fail | Fail | Daisy center against cream petals, honey ring on a cream belt |

The soft gouache pairs are readable when ink is on cream. They are not readable when a light badge color sits on sage grass, or when a cream glyph sits on coral, honey, or lavender.

### Badge layer the slice should draw

`docs/ASSET_SPECS.md` §6 paints cream glyphs on coral, lavender, and honey pennants. Those three pairs are 2.48:1, 1.93:1, and 1.62:1. All three miss the 3:1 graphics bar. Coral and honey are also only 1.53:1 apart, so blocked and ready look similar even to someone who sees color. Blocked and wrong share one coral.

Draw the readable status in code, on top of whatever pennant art arrives. One disc, top-right of the tile, 28×28 CSS px:

- Fill cream `#F6EBD5`.
- Border 2px ink `#39463B`. The border is what shows on grass (ink on sage is 4.77:1). The cream fill alone is 1.76:1 on sage.
- Glyph in ink, Nunito 700, 16px. Ink on cream is 8.41:1.

| State | Glyph on the disc | Pennant sprite behind it | Words on screen |
| --- | --- | --- | --- |
| Blocked | `!` | `badge.blocked` | A `blocked.*` label. See the table below. |
| Wrong item | `×` | `badge.wrong` | `blocked.wrongItem` or `blocked.refused` |
| Ready | check mark | `badge.ready` | `states.ready` |
| Waiting | `…` | `badge.waiting` | `states.waiting` or `states.waitingFor` |

Same disc position for every state, so the player learns one corner. The glyph and the sentence do the work. The pennant is decoration and can be omitted if the disc and the pennant crowd the flower.

Which sentence wins is already in `COPY.md`: a blocked exit beats Ready; a running timer is Processing; a timer paused because the exit is full is Blocked; a bed with no flower yet is Growing, and a paused bed is Blocked.

| Situation | Disc | Copy key |
| --- | --- | --- |
| Bed growing | none | `states.growing` |
| Output can leave | check | `states.ready` |
| Craft timer running | none | `states.processing` |
| Missing ingredients, nothing inside yet | `…` | `states.waiting` |
| Missing ingredients, part of the recipe is inside | `…` | `states.waitingFor` |
| Next tile is full | `!` | `blocked.exitFull` |
| Output aims at grass | `!` | `blocked.noExit` |
| Item is inside a machine that cannot use it | `×` | `blocked.wrongItem` |
| Input buffer is full | `!` | `blocked.inputFull` |
| Belt has no next tile | `!` | `blocked.beltEnd` |
| Belt item is refused by the machine it faces | `×` | `blocked.refused` |

Show the label in the inspector whenever that structure is selected. On the edge when a bed or machine first becomes blocked, also put that label in the notice line (the same moment `blocked` plays). Repeat it when the reason changes. Leave it alone on later ticks while the reason stays.

### Placement rings and selection

`tile.valid`, `tile.invalid`, and `tile.select` are sage, coral, and honey rings. On sage grass those are 1.76:1 (the sage ring against itself), 1.41:1, and 1.09:1. Stroke each overlay with 2px ink, and keep the shapes different:

| Overlay | Key | Shape, after the ink stroke |
| --- | --- | --- |
| Valid | `tile.valid` | Four open corner brackets. Empty middle. |
| Invalid | `tile.invalid` | The same brackets, plus an X across the tile. |
| Selected | `tile.select` | Four solid corner ticks, thicker than the valid brackets. |

The ghost uses the valid or invalid overlay. The selected structure keeps `tile.select` until another tile is selected.

### Facing

Sage chevrons on the cream belt are 1.76:1, under 3:1. Draw one shared ink arrow, about 10×8 CSS px, on the exit edge of every bed, machine, and belt. Point it the way the item leaves. The painted chevron and the wooden chute can stay. The arrow is the part that clears 3:1 (ink on cream 8.41:1, ink on sage 4.77:1).

The inspector line stays in step with the arrow: `Faces {facing}` for beds and machines, `Heading {facing}` for a carried item. Facing words are the screen words from `COPY.md`: up, right, down, left.

### Items

Items are shown at 32×32 CSS px on a 64px tile, on grass and on cream belts. Cream-on-cream and lavender-on-sage both fail (daisy petals on a belt are ~1:1 if both are cream; a lavender sprig on sage is 1.09:1; a honey daisy center on cream petals is 1.62:1).

Give every item a 1 screen-pixel ink outline (a second draw of the sprite, expanded by 1px, tinted `#39463B`, behind the sprite). Do this for:

- `item.daisy`
- `item.lavender`
- `item.daisy_bundle`
- `item.lavender_sachet`
- `item.mixed_bouquet`

Silhouette is the second channel. Keep these outlines distinct at 32px:

| Item | Key | Outline to protect |
| --- | --- | --- |
| Daisy | `item.daisy` | Round bloom, round center |
| Lavender | `item.lavender` | Long diagonal spike |
| Daisy Bundle | `item.daisy_bundle` | Three blooms and a bow knot |
| Lavender Sachet | `item.lavender_sachet` | Rectangular pouch, knot at the top |
| Mixed Bouquet | `item.mixed_bouquet` | Cone, wide at the flower end |

Selecting the belt announces the name via `states.belt.carrying` ("Carrying {item}"). The picture does not have to carry the name by itself.

### Beds and machines

Beds share one box (`bed.daisy.<f>.<state>`, `bed.lavender.<f>.<state>`). The plant tells them apart: round daisy heads, upright lavender spikes. Stages are already separate files: `empty` (soil and a divot), `grow0` (sprouts), `grow1` (buds), `ready` (open flowers). Blocked is the disc on top of `ready`, not a fifth frame.

| Machine | Key pattern | Outline |
| --- | --- | --- |
| Bundling Table | `machine.bundling.<f>.*` | Round top, spool of twine |
| Drying Bench | `machine.drying.<f>.*` | Rack with bunches hanging down |
| Arrangement Table | `machine.arrangement.<f>.*` | Round top, vase |
| Packing Station | `machine.packing.*` | Open crate and a hanging tag. No facing, no exit arrow. |

Machine frames: `idle` (empty tray), `work0`–`work3` (busy), `ready` (product on the tray). Packing uses `idle` and `receive0`–`receive3`. The disc plus the inspector label cover the case where two frames are hard to tell apart. Processing also shows `{elapsed}s of {total}s` from the inspector. That number is required. A honey progress bar with no number is not enough.

### Locked grass

`ground.locked` is a darker lawn plus a twine edge. Moss on sage is 2.20:1, so the darkness is not the cue. Draw the twine in ink. Building on it shows `errors.lockedPlot`.

## 2. Colorblind-safe redundancy

Do not ship a color filter in the slice. Ship a second channel on every state that currently depends on coral, sage, honey, or lavender. The pairs that collapse for red-green vision (protanopia and deuteranopia) are coral against sage or moss, and coral against honey. Lavender against sage is already 1.09:1, so blue-yellow vision (tritanopia) loses the waiting pennant and the bare lavender sprig.

| Meaning | Color that is not enough | Sprite key | Second channel |
| --- | --- | --- | --- |
| Valid tile | sage ring | `tile.valid` | Ink corner brackets, open middle |
| Invalid tile | coral ring, crosshatch | `tile.invalid` | Ink brackets plus an X |
| Selected | honey ring | `tile.select` | Thicker ink corner ticks |
| Blocked | coral pennant, `!` | `badge.blocked` | Ink `!` on the cream disc, plus a `blocked.*` sentence |
| Wrong item | coral pennant, `×` | `badge.wrong` | Ink `×` on the cream disc. Different glyph from blocked. |
| Waiting | lavender pennant, `…` | `badge.waiting` | Ink `…` on the cream disc, plus `states.waiting` or `states.waitingFor` |
| Ready | honey pennant, check | `badge.ready` | Ink check on the cream disc, plus `states.ready`, and the product sitting on the tray |
| Belt direction | sage chevron | `belt.straight`, `belt.corner.cw`, `belt.corner.ccw` | Ink exit arrow. Corner files already bend; the arrow sits on the exit. |
| Dead-end belt | end bumper | `belt.end` | The bumper shape plus `blocked.beltEnd` when an item is waiting there |
| Daisy vs lavender item | cream bloom vs lavender spike | `item.daisy`, `item.lavender` | Round vs spike, ink outline, name in the inspector |
| Bundle vs sachet vs bouquet | coral bow, lavender ribbon, pink ribbon | `item.daisy_bundle`, `item.lavender_sachet`, `item.mixed_bouquet` | Cluster, pouch, cone |
| Daisy bed vs lavender bed | petal heads vs lavender spikes | `bed.daisy.*`, `bed.lavender.*` | Same planter, different plant. Palette tooltip uses the building name. |
| Growing vs ready | smaller plant vs open flowers | `bed.*.grow0`, `grow1`, `ready` | Different frames, plus Growing or Ready in the inspector |
| Machine idle vs working vs ready | motion and a product on the tray | `machine.*.idle`, `work0`, `ready` | Frame, progress text, ready disc when the product is waiting |
| Packing received something | lid flutter | `machine.packing.receive0` | Order numerals change. Status `states.packing.receiving`. |
| Order complete | celebratory color | `ui.check` | The `complete` sentence, `celebration.earned`, and the next order card |
| Sound on / off | bell vs slashed bell | `ui.sound_on`, `ui.sound_off` | The word On or Off (`settings.on`, `settings.off`) |
| Music on / off | note vs slashed note | `ui.music_on`, `ui.music_off` | The word On or Off |
| Remove tool | coral tip on the trowel | `ui.remove` | The word Remove, and the palette hint `palette.hint.remove` |

Icon-only buttons use the `a11y.*` names in `COPY.md` as their accessible names. The visible word is still there for Pause, Fast, Build, Undo, Rotate, Basket, Settings, and How to Play.

**Post-slice:** a preview that simulates protanopia, deuteranopia, and tritanopia; a high-contrast theme with darker badge fills.

## 3. Reduced motion

One flag. Store it on the save's settings sibling, the object `docs/design/SLICE_ARCHITECTURE_RISKS.md` §1 tells you to keep separate from sim migrations.

```ts
settings: {
  sound: boolean;
  music: boolean;
  reducedMotion: boolean; // the only motion flag
  // tutorial step, speed, and seen-completion stay on this same object
}
```

`src/sim/save.ts` currently names that sibling `ui`, with `reducedMotion: 'system' | 'on' | 'off'`, plus `soundOn`, `musicOn`, tutorial fields, `speed`, and `seenCompletion`. Keep a single object, and keep those other fields. Prefer the key `settings` when you next touch the schema. On load, accept `settings` or `ui` so an existing save still applies.

Map an old tri-state string once:

| Stored value | Boolean written back |
| --- | --- |
| `"on"` | `true` |
| `"off"` | `false` |
| `"system"` | `true` when `prefers-reduced-motion: reduce` matches at load, otherwise `false` |

The settings screen is one toggle, On / Off, using `settings.reducedMotion`, `settings.on`, `settings.off`, and the help line `settings.reducedMotionHelp` ("Quiets extra movement. The garden still runs."). First launch with no save copies the OS media query into the boolean. After that, the saved boolean is the source of truth. Flipping the OS setting mid-session leaves the garden as the player set it.

Set `data-reduced-motion="true"` on the document root when the flag is on. CSS transitions under that attribute are 0ms. Phaser reads the same boolean. There is no second switch.

When the flag is on, hold or skip these:

| Motion | Keys | What to do |
| --- | --- | --- |
| Belt chevron crawl | `belt.straight`, `belt.corner.cw`, `belt.corner.ccw` frames 0–7 | Show frame 0. Direction stays on the ink arrow and the still chevron. |
| Ready-bed bounce | `bed.daisy.<f>.ready`, `bed.lavender.<f>.ready` | Hold the ready frame. |
| Machine work loops | `machine.bundling.<f>.work0–3`, `machine.drying.<f>.work0–3`, `machine.arrangement.<f>.work0–3` | Hold `work0` for the whole craft. |
| Packing flutter | `machine.packing.receive0–3` | Show `receive0` for a single beat, then `idle`. |
| Product pop | `fx.ring`, `fx.sparkle` | Draw neither. The product sprite appears in place. |
| Order confetti | `fx.petal.daisy`, `fx.petal.pink`, `fx.petal.lavender` | Draw none. The text card is the celebration. |
| HUD motion | panel slide, button scale, coin count-up, coach-mark bob, ghost pulse | One frame. Coin text sets to the new number. Ghost is a still sprite at 70% opacity. |
| Camera juice | shake, long ease | Cut. Following the cursor is a direct move. |

Keep running, because the help text says the garden still runs:

- The sim tick, including Fast. The flag does not change tick length or ticks per frame.
- Items sliding from tile center to tile center. Linear, one tick long (100ms at 10 Hz), no bounce, no overshoot.
- Status discs. They appear in one frame.
- Inspector progress text.

Pause still freezes the sim. Reduced motion is not pause.

**Post-slice:** a third value that follows the OS live; a control that snaps item slides to zero duration.

## 4. Full keyboard play

Two focus layers.

1. The React HUD is normal tab order, with a visible focus ring.
2. The garden is one widget. Accessible name: `a11y.game` ("Petalworks garden"). Give it `role="application"` so arrows reach the game. One tab stop, not one stop per tile (a 16×12 grid would be 192 stops).

Focus ring for HUD controls:

- 2px solid ink outline, offset 2px.
- A 2px cream halo outside that, so the ink ring still reads on sage (ink on sage is 4.77:1) and on cream (ink on cream is 8.41:1).
- Use `:focus-visible`. A pointer click does not need the halo stuck on.

Tab order: Skip to garden, then the top bar (order, coins, Pause, Fast, Build, Undo, Rotate, Basket, How to Play, Settings), then the build palette if it is open, then the garden widget. Dialogs trap focus: New Game confirm, unreadable-save confirm, expansion confirm, ending card, and Settings or How to Play while they cover the garden. Esc closes the topmost dialog and returns focus to the button that opened it.

Inside the garden, arrows move a cursor. The cursor uses `tile.select`. The camera follows when the cursor reaches the edge of the view. The inspector follows the cursor. A polite live region announces the tile when the cursor stops: building name, status label, facing. Wait until arrow-repeat ends (about 400ms) and announce the last tile, so a held arrow does not read every square.

### Key map

Bare keys only. Call `preventDefault` for the keys in this table while focus is on the garden or a game control, so the page does not scroll. If a text field is ever added, skip the preventDefault while that field is focused.

| Action | Key | Notes |
| --- | --- | --- |
| Move the cursor | Arrow keys, and W A S D | Same move. Camera follows at the edge. |
| Place the armed tool, or select the structure | Enter, or Space | On a belt tool, Enter sets the start of a path. More arrows extend the ghost. Enter again commits the path. |
| Rotate the ghost or the selected structure | R | Cycles up, right, down, left. Matches the brief and `controls[rotate]`. |
| Rotate the other way | Shift+R | Same cycle, reversed, so a miss is one key, not three. |
| Cancel the tool, path, or dialog | Esc | Closes the topmost dialog first, then cancels the armed tool, then clears the selection. Right-click still cancels for the pointer. |
| Undo last build | Z, Ctrl+Z, Cmd+Z | Same action as the Undo button. `preventDefault` on the modified forms. |
| Arm Remove | X | Same as choosing Remove in the palette. Enter on a structure removes it. |
| Remove the selected structure | Delete | Same result. Leaves Backspace to the browser. |
| Toggle the build menu | B | Focus moves into the palette when it opens. |
| Pause or resume | P | Updates `hud.pause` / `hud.resume`. |
| Toggle Fast | F | Bare F. |
| Zoom in / out | `=` and `-` | Bare keys. Camera stays within the brief's zoom limits. |
| Recenter | Home | Frames the open garden. |

Belt path from the keyboard: arm Belt, Enter on the first tile, arrow along the grass, Enter to place, Esc to drop the ghost. It calls the same action as a pointer drag. A path that runs out of coins shows `errors.fundsPath`, and tiles already paid for stay placed. Occupied tiles show `errors.dragSkipped` when the drag skips them.

Remove, rotate, and undo that the sim rejects use the existing error lines (`errors.rotateHolding`, `errors.undoEmpty`, `errors.undoUnsafe`, `errors.removeEmpty`, and the rest). The notice line is the feedback. Play `ui_error` with it when sound is on.

Pointer controls stay as they are: left-click places or selects, drag lays belts, right-click cancels, wheel zooms, drag on empty grass or middle mouse pans.

When these keys ship, add the new rows to the How to Play controls table in `docs/content/COPY.md`. That table's rule is that every listed key exists in the build. Pause and Fast are buttons in the copy today. Once P and F work, name them there.

### Leave these browser shortcuts alone

Bind none of these, with or without a modifier:

- Ctrl or Cmd with R, T, W, N, L, F, P, S (reload, tab, close, window, address bar, find, print, save).
- Ctrl or Cmd with `+`, `-`, or `0` (browser zoom). Game zoom is the bare `-` and `=` keys.
- Alt+Left and Alt+Right (history).
- Backspace with nothing typed (history in some browsers). Remove is X and Delete.
- F5, F11, F12.

**Post-slice:** rebinding, and number keys for palette slots. Slot meanings change as orders unlock, so the slice leaves the number row free.

## 5. Type size and UI scale

Desktop first. All player text is React, Nunito, ink on cream.

| Role | Size | Weight | Line height |
| --- | --- | --- | --- |
| Inspector, errors, coach marks, settings, How to Play | 16px | 400 | 1.45 |
| Buttons, palette names, top-bar labels | 16px | 600 | 1.45 |
| Coin amount, order progress numerals | 18px | 700 | 1.3 |
| `title.savedHere`, `title.soundHint` | 14px | 400 | 1.4 |

14px is the floor, and only those two footer lines use it. Nunito's soft terminals get muddy under that. Buttons include the visible word. The icon inside a button is 24px. The hit target is at least 44×44 CSS px.

Check the fit at 100% browser zoom on these windows:

| Window | Why it is in the list |
| --- | --- |
| 1280×800 | Minimum in `qa/ACCEPTANCE_TEST_PLAN.md` |
| 1366×768 | Common short laptop |
| 1440×900 | Common laptop |
| 1536×864 | 1920×1080 at 125% OS scaling |
| 1920×1080 | Common external monitor |

Layout budget: top bar 56px on one row, build palette 256px and collapsible. A 16×12 grid at the native 64px tile is 1024×768, which is taller than a 768px window once the top bar is in. Default zoom fits the open garden in the space that is left.

- Target tile at that fit: **at least 48 CSS px** on every window in the table, palette open.
- If the fit would drop under 48px, start with the palette collapsed and fit again.
- Hard floor: **40 CSS px**. Under that, the player zooms in. Default zoom on the table above stays at or above 48.

Worked example, 1366×768, palette open at 256px, top bar 56px, 16px of padding: about 1094×696 left. A 48px tile needs 768×576. The fit lands near 56px. That is the intended default.

At 200% browser zoom the HUD reflows. The top bar wraps to two rows. The order sentence stays fully visible. The palette collapses to the icon rail. The garden still pans and zooms. No `overflow: hidden` on the order, the coin amount, or the inspector.

**Post-slice:** a UI scale slider. The slice's scale is browser zoom, OS scaling, and this fit rule.

## 6. Audio, captions, and mute

Every cue in `assets/audio/AUDIO_MANIFEST.md` has a visual at the same moment. The visual is the caption. There is no separate subtitle track in the slice.

Two booleans on the same `settings` object:

| Field | Copy | Default | What off does |
| --- | --- | --- | --- |
| `settings.sound` | `settings.sound` | `true` | Gain 0 on every effect. Stop `belt_tick` and `machine_working`. |
| `settings.music` | `settings.music` | `true` | Gain 0 on `music`, and stop the buffer. |

Current save fields are `ui.soundOn` and `ui.musicOn`. Accept those names on load and write `settings.sound` and `settings.music` on the next save.

Persist both on toggle, in the same autosave as the garden. Reload restores them. New Game copies `settings` onto the new file so a mute survives a restart. The garden, coins, and orders reset. The mute stays.

`producer/REVISIONS.md`: music stays silent until the first click or key, even when `settings.music` is true. Effects wait for that same gesture (browser audio unlock), then follow `settings.sound`. The title already says `title.soundHint` ("Sound starts after your first click.").

Show On / Off in words next to `ui.sound_on` / `ui.sound_off` and `ui.music_on` / `ui.music_off`. Accessible names are `a11y.soundOn`, `a11y.soundOff`, `a11y.musicOn`, `a11y.musicOff`.

One notice region, `aria-live="polite"`, `aria-atomic="true"`, holds errors, the blocked edge line, unlock lines, order-complete lines, and basket lines. The order progress element is its own polite region and uses `hud.orderDelivered` ("Delivered {have} of {need}"). A delivery updates the numerals in place. It does not add a toast. `COPY.md` already says not to toast every daisy.

| Cue key | When it plays | Visual at that moment |
| --- | --- | --- |
| `ui_click` | A button, palette item, toggle, or menu row activates | The control's pressed state. Focus ring stays put. |
| `ui_hover` | Pointer enters a button or palette item | Hover style on that control (ink underline). Once per entry. No notice. |
| `ui_error` | The garden refuses the action | The matching `errors.*` sentence in the notice region |
| `build_place` | A bed, belt tile, or machine is placed | The sprite is on the tile. The ghost clears. |
| `build_rotate` | R, Shift+R, or the Rotate control | The ink arrow and the chute turn. Inspector facing text updates. |
| `build_remove` | Remove succeeds | The structure is gone. `basket.removed` or `basket.removedMany`, and `basket.refund` when coins return. |
| `undo` | Z undoes a build | The previous layout is back. If nothing changed: `errors.undoEmpty` or `errors.undoUnsafe`. |
| `belt_tick` | An item is riding a belt | The item sprite advances one tile. The sprite is the cue. No per-tile notice. |
| `item_pop` | A bundle, sachet, or bouquet finishes | That item sprite is on the output tray. Status Ready, or Blocked if it cannot leave. |
| `flower_bloom` | A bed reaches ready | The bed frame swaps to `bed.<flower>.<f>.ready`. Status `states.ready`. |
| `machine_working` | Any machine is processing | `work0` (and `work1–3` only when reduced motion is off). Inspector shows Processing and `{elapsed}s of {total}s`. |
| `blocked` | A bed or machine becomes blocked | The `!` disc, the `blocked.*` label in the inspector, and one notice. Same edge rule as the sound: once per new block, again if the reason changes. |
| `coins` | Coins rise outside a celebration | The top-bar coin number updates. A refund also shows `basket.refund`. |
| `order_complete` | Orders 1–5 pack | `complete`, then `celebration.earned`, then `unlockLine` when there is one. The order card changes. |
| `unlock` | A bed or machine becomes available | The unlock sentence, and the new row in the build menu |
| `final_celebration` | Order 6 packs | The ending card: `ending.title`, `ending.body`. This cue replaces `order_complete` for that order. |
| `deliver` | Packing accepts an item | `hud.orderProgress` increments. Packing status `states.packing.receiving`. The polite order region announces `hud.orderDelivered`. If several items arrive together, announce the latest count once. |
| `music` | Background loop | The music row shows On or Off. The loop itself has no caption. |

**Post-slice:** a caption history log, separate volume sliders, and spoken descriptions of tiles the cursor is not on.

## 7. Review checklist

The one-page sheet is `qa/accessibility-checklist.md`. Tick that when you review a build. The rows below are the same checks.

Contrast and state:

- [ ] Top bar, order, inspector, and errors are ink `#39463B` on cream `#F6EBD5`.
- [ ] Blocked, wrong, ready, and waiting each show the cream disc, the ink glyph (`!`, `×`, check, `…`), and the matching sentence.
- [ ] Valid, invalid, and selected tiles are different shapes with an ink stroke.
- [ ] Beds, machines, and belts show the ink exit arrow. The inspector facing text matches it.
- [ ] The five item sprites have an ink outline and different silhouettes at 32px.
- [ ] A blocked bed, a ready bed, and a growing bed are distinguishable with the monitor in grayscale.

Motion, keys, type, sound:

- [ ] `settings.reducedMotion` is one boolean, survives reload, and stops the motions in §3 while the garden keeps running.
- [ ] A garden can be placed, rotated, removed, and inspected with the key map in §4, and Ctrl+R still reloads the page.
- [ ] Focus rings are visible. Dialogs trap focus. Esc closes the top one.
- [ ] At 1366×768 and 1280×800, 100% zoom, body text is at least 16px and default tiles are at least 48px.
- [ ] At 200% zoom the order sentence is fully on screen.
- [ ] Each cue in §6 has its visual. Sound off and music off survive reload and New Game.

**Post-slice, not a fail on this sheet:** remappable keys, a UI scale slider, a high-contrast theme, colorblind preview filters, a caption log, per-tile screen-reader tour of the whole garden, live "follow the OS" motion, volume sliders.
