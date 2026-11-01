# Petalworks audio manifest

Semantic keys for the game to load. Prefer the `.ogg` file (Vorbis).
The `.mp3` beside it is a fallback for decoders without Vorbis.

All of this was synthesized for the project. See `LICENSE.md` and
`_source/generate_audio.py`. Sample rate is 44100 Hz.
Sound effects are mono. `music` is a narrow stereo pair.

## How to play them

- Unlock Web Audio on the first pointer or key gesture, then decode each
  file once and reuse the `AudioBuffer`.
- **Suggested volume** is a linear gain on top of the mastered file
  (`1.0` plays it as mastered). The set is already quiet.
- Most effects are mastered around **−18 LUFS** (K-weighted, ITU-R BS.1770),
  with true peak at or below about −1.5 dBTP. A few cues are quieter on
  purpose: hover, the belt cadence, and the machine loop.
- Keep **one** instance of `music`, **one** of `machine_working`, and **one**
  of `belt_tick`. One-shots may overlap; they are short.
- Honor separate sound-effects and music toggles. Fade `music` down on pause.
  Stop `machine_working` and `belt_tick` while paused.
- Loop flags below refer to the source waveform. Loop the Ogg buffer.
  MP3 frame padding can leave a few milliseconds of gap or pre-roll on some
  decoders, so do not loop the MP3 if the Ogg decoded.
- `docs/ASSET_SPECS.md` §11 sketched an earlier, shorter list at about −14 LUFS
  and an ambient bed of birds and breeze. This set is mastered quieter, uses
  the keys below, and uses a music-box loop instead of nature ambience so the
  whole game shares one voice. Map the old filenames like this if a caller
  still uses them:

| Earlier name | Use |
| --- | --- |
| `ui_click` | `ui_click` |
| `place` | `build_place` |
| `rotate` | `build_rotate` |
| `remove` | `build_remove` |
| `invalid` | `ui_error` |
| `pop` | `item_pop` |
| `deliver` | `deliver` |
| `order_complete` | `order_complete` |
| `unlock` | `unlock` |
| `ambient_garden` | `music` |

## Cues

| Key | Files | Duration | Loop | Loudness | Suggested volume |
| --- | --- | --- | --- | --- | --- |
| `ui_click` | `ui_click.ogg`, `ui_click.mp3` | 0.160 s | no | -18.0 LUFS | 0.55 |
| `ui_hover` | `ui_hover.ogg`, `ui_hover.mp3` | 0.070 s | no | -26.0 LUFS | 0.40 |
| `ui_error` | `ui_error.ogg`, `ui_error.mp3` | 0.414 s | no | -20.0 LUFS | 0.50 |
| `build_place` | `build_place.ogg`, `build_place.mp3` | 0.320 s | no | -18.0 LUFS | 0.62 |
| `build_rotate` | `build_rotate.ogg`, `build_rotate.mp3` | 0.173 s | no | -18.0 LUFS | 0.50 |
| `build_remove` | `build_remove.ogg`, `build_remove.mp3` | 0.259 s | no | -18.0 LUFS | 0.55 |
| `undo` | `undo.ogg`, `undo.mp3` | 0.880 s | no | -18.0 LUFS | 0.52 |
| `belt_tick` | `belt_tick.ogg`, `belt_tick.mp3` | 0.750 s | yes | -36.4 LUFS | 0.30 |
| `item_pop` | `item_pop.ogg`, `item_pop.mp3` | 0.310 s | no | -18.0 LUFS | 0.60 |
| `flower_bloom` | `flower_bloom.ogg`, `flower_bloom.mp3` | 1.390 s | no | -18.0 LUFS | 0.62 |
| `machine_working` | `machine_working.ogg`, `machine_working.mp3` | 2.000 s | yes | -22.0 LUFS | 0.38 |
| `blocked` | `blocked.ogg`, `blocked.mp3` | 0.860 s | no | -20.0 LUFS | 0.46 |
| `coins` | `coins.ogg`, `coins.mp3` | 0.620 s | no | -18.0 LUFS | 0.50 |
| `order_complete` | `order_complete.ogg`, `order_complete.mp3` | 1.630 s | no | -18.0 LUFS | 0.70 |
| `unlock` | `unlock.ogg`, `unlock.mp3` | 1.325 s | no | -18.0 LUFS | 0.68 |
| `final_celebration` | `final_celebration.ogg`, `final_celebration.mp3` | 3.920 s | no | -18.0 LUFS | 0.74 |
| `deliver` | `deliver.ogg`, `deliver.mp3` | 0.260 s | no | -20.0 LUFS | 0.48 |
| `music` | `music.ogg`, `music.mp3` | 90.00 s | yes | -18.0 LUFS | 0.42 |

### `ui_click`

- **Files:** `ui_click.ogg`, `ui_click.mp3`
- **Duration:** 0.160 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -18.0 LUFS integrated
- **Peak:** -5.0 dBFS sample, -5.0 dBTP
- **Suggested volume:** 0.55
- **Character:** Short rounded wooden tick.
- **When to play:** A button, palette item, toggle, or menu row is activated.

### `ui_hover`

- **Files:** `ui_hover.ogg`, `ui_hover.mp3`
- **Duration:** 0.070 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -26.0 LUFS integrated
- **Peak:** -15.2 dBFS sample, -15.1 dBTP
- **Suggested volume:** 0.40
- **Character:** Very subtle paper fingertip. Mastered quieter than the other interface cues.
- **When to play:** The pointer enters a button or build-palette item. Play at most once per control entry, and ignore retriggers closer than about 80 ms.

### `ui_error`

- **Files:** `ui_error.ogg`, `ui_error.mp3`
- **Duration:** 0.414 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -20.0 LUFS integrated
- **Peak:** -5.4 dBFS sample, -5.4 dBTP
- **Suggested volume:** 0.50
- **Character:** Two soft low wooden taps, a falling minor third. Dull on purpose, not a buzzer.
- **When to play:** The player tries something the garden refuses: invalid placement, occupied tile, or not enough coins.

### `build_place`

- **Files:** `build_place.ogg`, `build_place.mp3`
- **Duration:** 0.320 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -18.0 LUFS integrated
- **Peak:** -2.3 dBFS sample, -2.3 dBTP
- **Suggested volume:** 0.62
- **Character:** Warm wooden set-down, lower and rounder than the UI click.
- **When to play:** A bed, belt, or machine is placed, including each tile of a belt drag.

### `build_rotate`

- **Files:** `build_rotate.ogg`, `build_rotate.mp3`
- **Duration:** 0.173 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -18.0 LUFS integrated
- **Peak:** -5.8 dBFS sample, -5.8 dBTP
- **Suggested volume:** 0.50
- **Character:** A tiny two-step wooden ratchet.
- **When to play:** A placed or ghosted structure rotates (the R key or the rotate control).

### `build_remove`

- **Files:** `build_remove.ogg`, `build_remove.mp3`
- **Duration:** 0.259 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -18.0 LUFS integrated
- **Peak:** -3.2 dBFS sample, -3.1 dBTP
- **Suggested volume:** 0.55
- **Character:** A soft paper rustle with a small wooden lift.
- **When to play:** The delete tool removes an empty structure.

### `undo`

- **Files:** `undo.ogg`, `undo.mp3`
- **Duration:** 0.880 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -18.0 LUFS integrated
- **Peak:** -5.3 dBFS sample, -5.3 dBTP
- **Suggested volume:** 0.52
- **Character:** Three quiet music-box notes stepping down, C A F.
- **When to play:** A build action is undone (Z).

### `belt_tick`

- **Files:** `belt_tick.ogg`, `belt_tick.mp3`
- **Duration:** 0.750 s
- **Channels:** 1
- **Loop:** yes, seamless
- **Loudness:** -36.4 LUFS integrated
- **Peak:** -20.0 dBFS sample, -20.0 dBTP
- **Suggested volume:** 0.30
- **Character:** Very subtle wooden cadence. 0.75 s seamless loop; the knock occupies the first tenth.
- **When to play:** While at least one item is riding a belt. Loop it as a slow cadence, or play it once each time an item advances a tile. Do not stack copies. Stop it while the game is paused. It is mostly silence with one soft knock, so do not turn it up to chase the integrated-loudness number.

### `item_pop`

- **Files:** `item_pop.ogg`, `item_pop.mp3`
- **Duration:** 0.310 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -18.0 LUFS integrated
- **Peak:** -4.8 dBFS sample, -4.8 dBTP
- **Suggested volume:** 0.60
- **Character:** A small warm bubble with a short music-box glint.
- **When to play:** A machine finishes a product (Daisy Bundle, Lavender Sachet, or Mixed Bouquet) and the sprite pops onto the output.

### `flower_bloom`

- **Files:** `flower_bloom.ogg`, `flower_bloom.mp3`
- **Duration:** 1.390 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -18.0 LUFS integrated
- **Peak:** -5.0 dBFS sample, -5.0 dBTP
- **Suggested volume:** 0.62
- **Character:** A slow A–C–E–A opening, with a quiet plucked root underneath.
- **When to play:** A flower bed reaches ready and a bloom is waiting on the chute.

### `machine_working`

- **Files:** `machine_working.ogg`, `machine_working.mp3`
- **Duration:** 2.000 s
- **Channels:** 1
- **Loop:** yes, seamless
- **Loudness:** -22.0 LUFS integrated
- **Peak:** -7.7 dBFS sample, -7.7 dBTP
- **Suggested volume:** 0.38
- **Character:** Two-second seamless loop: a soft G/D hum and two alternating plucks. Not a motor.
- **When to play:** While any machine is processing. Keep a single shared loop no matter how many machines are busy, and pause it with the game. It should sit under the belts, not replace them.

### `blocked`

- **Files:** `blocked.ogg`, `blocked.mp3`
- **Duration:** 0.860 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -20.0 LUFS integrated
- **Peak:** -8.3 dBFS sample, -8.3 dBTP
- **Suggested volume:** 0.46
- **Character:** A gentle falling E–C music-box pair. Distinct from the duller ui_error taps.
- **When to play:** Edge-trigger when a bed or machine becomes blocked (output full or nowhere to go). Do not retrigger every tick while it stays blocked.

### `coins`

- **Files:** `coins.ogg`, `coins.mp3`
- **Duration:** 0.620 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -18.0 LUFS integrated
- **Peak:** -6.1 dBFS sample, -6.0 dBTP
- **Suggested volume:** 0.50
- **Character:** Four quick honey-colored tines. Ceramic, not a harsh coin shower.
- **When to play:** When the coin count increases outside a celebration, such as a refund. On order complete, either skip this or play it quietly about 0.35 s after order_complete so the two do not stack at full level.

### `order_complete`

- **Files:** `order_complete.ogg`, `order_complete.mp3`
- **Duration:** 1.630 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -18.0 LUFS integrated
- **Peak:** -5.8 dBFS sample, -5.8 dBTP
- **Suggested volume:** 0.70
- **Character:** Warm F–A–C chime with a soft F above it. About a second and a half.
- **When to play:** Orders 1 through 5 are fulfilled. For order 6, play final_celebration instead of this.

### `unlock`

- **Files:** `unlock.ogg`, `unlock.mp3`
- **Duration:** 1.325 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -18.0 LUFS integrated
- **Peak:** -4.8 dBFS sample, -4.8 dBTP
- **Suggested volume:** 0.68
- **Character:** A short rising F-major run, F G A C D F.
- **When to play:** A new bed, machine, or recipe becomes available after an order.

### `final_celebration`

- **Files:** `final_celebration.ogg`, `final_celebration.mp3`
- **Duration:** 3.920 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -18.0 LUFS integrated
- **Peak:** -5.3 dBFS sample, -5.3 dBTP
- **Suggested volume:** 0.74
- **Character:** The order motif opened into a small phrase and a soft F-major chord. The longest celebratory cue.
- **When to play:** The sixth order (the Mixed Bouquet) is delivered, in place of order_complete. Then continue in the sandbox with the music still playing.

### `deliver`

- **Files:** `deliver.ogg`, `deliver.mp3`
- **Duration:** 0.260 s
- **Channels:** 1
- **Loop:** no
- **Loudness:** -20.0 LUFS integrated
- **Peak:** -6.5 dBFS sample, -6.4 dBTP
- **Suggested volume:** 0.48
- **Character:** A short paper rustle, softer than build_remove. Included so packing has its own cue.
- **When to play:** An item is accepted by the Packing Station. Skip it if several items arrive in the same moment and just play it once.

### `music`

- **Files:** `music.ogg`, `music.mp3`
- **Duration:** 90.00 s
- **Channels:** 2
- **Loop:** yes, seamless
- **Loudness:** -18.0 LUFS integrated
- **Peak:** -10.0 dBFS sample, -10.0 dBTP
- **Suggested volume:** 0.42
- **Character:** Music-box lead and soft plucked harmony in F major, narrow stereo, 90 second seamless loop.
- **When to play:** The calm background loop, from the main menu through play and the sandbox after order 6. Honor the music toggle separately from sound effects. Fade it down while paused rather than cutting it. Loop the Ogg buffer; it is 90 seconds and seamless.

## Measured seam and offset

Checked on the float render before encoding. DC is the largest absolute
channel mean. Seam is the absolute jump from the last sample to the first
(loops only).

| Key | DC | Seam |
| --- | --- | --- |
| `ui_click` | 1.48e-05 | — |
| `ui_hover` | 2.26e-09 | — |
| `ui_error` | 3.65e-06 | — |
| `build_place` | 1.54e-05 | — |
| `build_rotate` | 6.51e-06 | — |
| `build_remove` | 1.44e-06 | — |
| `undo` | 1.44e-06 | — |
| `belt_tick` | 5.37e-07 | 0.00e+00 |
| `item_pop` | 2.04e-05 | — |
| `flower_bloom` | 5.19e-07 | — |
| `machine_working` | 1.79e-06 | 1.18e-03 |
| `blocked` | 2.39e-06 | — |
| `coins` | 1.51e-06 | — |
| `order_complete` | 2.00e-06 | — |
| `unlock` | 1.27e-06 | — |
| `final_celebration` | 8.68e-07 | — |
| `deliver` | 3.00e-11 | — |
| `music` | 2.78e-16 | 7.08e-04 |

Regenerate with `python3 assets/audio/_source/generate_audio.py`.
The seed is fixed, so the same script version produces the same audio.
