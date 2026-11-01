# Petalworks — Asset Specifications (v1)

This is the complete sprite list for the first-pass slice. The art agent can start from this file immediately. Everything here is loaded through `src/assets/manifest.ts`; the game never references file names directly, so delivering any one file replaces its interim stand-in with no code changes.

## Global rules

| Rule | Value |
| --- | --- |
| Tile size in game | **64 × 64 px** (1×) |
| Source size | **Drawn at 2× = 128 × 128 px per tile** (the game downsamples; keep edges crisp) |
| Perspective | **True top-down**, no perspective tilt. Height is suggested only by shadow and shading, never by a visible side face taller than ~8 source px. |
| Light | From the **top-left**. Highlights upper-left, shadows lower-right. Keep the angle identical on every sprite. |
| Shadows | Soft, baked into the sprite, ink `#39463B` at ~25–35% opacity, offset about 4–6 source px down-right, blurred ~4 px. Shadows may bleed past the tile edge up to 8 source px (the canvas allows this: see "canvas" column). |
| Background | **Fully transparent PNG** (8-bit alpha). WebP acceptable if lossless. |
| Style | Painterly storybook gouache: soft but rich color, textured edges, subtle paper grain inside shapes, warm highlights, delicate shadows. No glossy plastic, no vector-clean geometry, no outlines thicker than ~3 source px, no neon, no bloom. |
| Palette | cream `#F6EBD5`, sage `#A8B99A`, moss `#657C58`, petal pink `#E9A8AF`, coral `#D77F70`, lavender `#B7A4CE`, honey `#DDB66C`, ink `#39463B`. Wood: warm honey-brown family. Soil: deep warm umber (not black). Adjust saturation for legibility; items on belts must pop against both grass and belt. |
| Line weight | Suggested, not inked: a darker painted edge of ~2 source px where forms meet. Consistent across all sprites. |
| Delivery | Drop files into `assets/art/` using the exact file names below. Animation frames are separate files numbered from `0` (e.g. `belt_straight_0.png` … `belt_straight_7.png`). Do not deliver sprite sheets; the build packs them. |
| Interim | Until a real file lands, the game loads a programmatic stand-in from `assets/interim/` with the same file name. Stand-ins are flagged interim in the manifest and in `KNOWN_ISSUES.md`. |

"Canvas" below is the PNG size in source pixels. "Footprint" is the grid area the thing occupies. Where canvas is larger than footprint, the extra is overhang for shadow or foliage, centered on the footprint.

## Facing conventions

Machines and beds have a **facing**: the side their output leaves from. Belts have a **direction of travel**. Four facings: `n`, `e`, `s`, `w`.

- Deliver **all four facing variants** for beds and machines so the top-left light stays correct.
- If time is short, deliver the `e` variant first. The game will rotate it for the other three facings (lighting will be slightly off) until the others arrive.
- Belts are flat enough that rotation is acceptable; deliver only the variants listed.

## 1. Ground and edges

| Key | File | Canvas | Footprint | Frames | Description |
| --- | --- | --- | --- | --- | --- |
| `ground.grass.0` | `ground_grass_0.png` | 128×128 | 1×1 | 1 | Base garden lawn. Sage/moss mottled gouache, barely-there paper grain, no visible tile seams (edges must tile seamlessly with all other grass variants in any arrangement). |
| `ground.grass.1` | `ground_grass_1.png` | 128×128 | 1×1 | 1 | Same, with a few painted blades / a small clover tuft. Seamless with variant 0. |
| `ground.grass.2` | `ground_grass_2.png` | 128×128 | 1×1 | 1 | Same, with two or three tiny wildflower dots (pink/cream). Seamless. |
| `ground.grass.3` | `ground_grass_3.png` | 128×128 | 1×1 | 1 | Same, with a small smooth stone. Seamless. |
| `edge.hedge.n` | `edge_hedge_n.png` | 128×128 | 1×1 | 1 | Border foliage strip along the **north** side of the garden (the hedge sits in the upper 60% of the tile, lawn below). Clipped boxwood / leafy hedge, moss with sage highlights top-left. Tiles seamlessly left-right. |
| `edge.hedge.s` | `edge_hedge_s.png` | 128×128 | 1×1 | 1 | South strip (hedge in lower 60%). |
| `edge.hedge.e` | `edge_hedge_e.png` | 128×128 | 1×1 | 1 | East strip (hedge in right 60%). |
| `edge.hedge.w` | `edge_hedge_w.png` | 128×128 | 1×1 | 1 | West strip (hedge in left 60%). |
| `edge.hedge.ne` | `edge_hedge_ne.png` | 128×128 | 1×1 | 1 | Outer corner joining the north and east strips. |
| `edge.hedge.nw` | `edge_hedge_nw.png` | 128×128 | 1×1 | 1 | Outer corner north-west. |
| `edge.hedge.se` | `edge_hedge_se.png` | 128×128 | 1×1 | 1 | Outer corner south-east. |
| `edge.hedge.sw` | `edge_hedge_sw.png` | 128×128 | 1×1 | 1 | Outer corner south-west. |
| `ground.locked` | `ground_locked.png` | 128×128 | 1×1 | 1 | Unopened garden plot (used for the 20×14 expansion before it is bought): wilder, longer grass, slightly darker and desaturated, with a dotted-looking painted twine edge. Seamless. |

## 2. Flower beds (1×1, four facings, stateful)

Each bed is a low wooden planter box filled with soil. The **facing** side has a tiny wooden chute/lip where flowers exit onto the belt. Beds have growth stages. File pattern: `bed_<flower>_<facing>_<state>.png`.

States (one file each): `empty` (soil only, a seed divot), `grow0` (sprouts), `grow1` (buds), `ready` (open flowers, fully bloomed, slightly bouncing when animated by the game). The game adds a shared **blocked** badge over `ready` when output is blocked (see §6), so no blocked frame is needed.

| Key pattern | File pattern | Canvas | Footprint | Variants |
| --- | --- | --- | --- | --- |
| `bed.daisy.<f>.<state>` | `bed_daisy_<f>_<state>.png` | 144×144 (8 px overhang each side) | 1×1 | 4 facings × 4 states = 16 files |
| `bed.lavender.<f>.<state>` | `bed_lavender_<f>_<state>.png` | 144×144 | 1×1 | 4 facings × 4 states = 16 files |

- Daisy Bed: pale honey wood box, warm soil; daisies with cream petals and honey centers, 3–5 blooms when `ready`.
- Lavender Bed: slightly greyer weathered wood; lavender spikes in lavender `#B7A4CE` with a deeper violet shade, sage-green stems, 4–6 spikes when `ready`.
- Keep the box silhouette identical between flowers so players read "bed" first and "which flower" second.

## 3. Conveyor belts

Flat canvas-and-wood garden conveyors: pale cream canvas strip with tiny stitched honey-brown rollers on the sides, and painted sage arrow chevrons showing travel direction. Belts are animated by cycling frames so the chevrons appear to crawl.

| Key | File | Canvas | Footprint | Frames | Description |
| --- | --- | --- | --- | --- | --- |
| `belt.straight` | `belt_straight_<0-7>.png` | 128×128 | 1×1 | 8 | Travel **west → east** (left to right). Chevrons advance 1/8 of their spacing per frame so the loop is seamless. Game rotates for n/s/w. |
| `belt.corner.cw` | `belt_corner_cw_<0-7>.png` | 128×128 | 1×1 | 8 | Enters from **west**, exits **south** (a clockwise turn when viewed top-down). Game rotates for other three. |
| `belt.corner.ccw` | `belt_corner_ccw_<0-7>.png` | 128×128 | 1×1 | 8 | Enters from **west**, exits **north** (counter-clockwise). |
| `belt.end` | `belt_end.png` | 128×128 | 1×1 | 1 | Small end-stop bumper drawn on the **east** edge; the game overlays this on a belt whose next tile is empty so dead-ends read clearly. |

Both merge sides of a belt tile are open, so a belt can be fed from behind or from either side; no special merge sprite is needed.

## 4. Machines (1×1, four facings, stateful)

All machines accept input from any adjacent belt pointing into them and output only on the **facing** side, where a small wooden tray or chute is drawn. File pattern: `machine_<name>_<facing>_<state>.png`; `work` is a 4-frame loop (`work0`…`work3`).

| Key pattern | File pattern | Canvas | Footprint | Variants | Description |
| --- | --- | --- | --- | --- | --- |
| `machine.bundling.<f>.<state>` | `machine_bundling_<f>_{idle,work0..3,ready}.png` | 144×144 | 1×1 | 4 × 6 = 24 | **Bundling Table.** Round-cornered honey-wood table, a big spool of coral twine, a pair of brass snips. `work` frames: twine spool turns, a ribbon loops. `ready`: a finished tied bundle sits on the output tray. |
| `machine.drying.<f>.<state>` | `machine_drying_<f>_{idle,work0..3,ready}.png` | 144×144 | 1×1 | 24 | **Drying Bench.** Weathered sage-grey bench with a small rack of lavender bunches hanging upside-down and a muslin pouch. `work`: bunches sway and dust motes drift. `ready`: a sachet on the tray. |
| `machine.arrangement.<f>.<state>` | `machine_arrangement_<f>_{idle,work0..3,ready}.png` | 144×144 | 1×1 | 24 | **Arrangement Table.** Cream-painted round table with a lavender cloth, a short vase, scattered petals, a roll of kraft paper. `work`: hands-free: stems lift into the vase one by one. `ready`: wrapped bouquet on the tray. |
| `machine.packing.<state>` | `machine_packing_{idle,receive0..3}.png` | 144×144 | 1×1 | 5 (no facing: accepts from all sides, outputs nothing) | **Packing Station.** Open wooden crate lined with cream paper, a stack of flat boxes, a little honey wax-seal stamp and a hanging tag. `receive` frames: lid flap flutters and a tag swings when an item arrives. |

## 5. Items (what rides on belts)

Items are small, must read against grass **and** belt canvas, and carry their own tiny soft shadow. Drawn centered in a 64×64 source canvas (shown at 32×32 at 1×).

| Key | File | Canvas | Description |
| --- | --- | --- | --- |
| `item.daisy` | `item_daisy.png` | 64×64 | Single daisy seen from above: 8–10 cream petals, honey center, hint of a sage stem peeking out. |
| `item.lavender` | `item_lavender.png` | 64×64 | A single lavender sprig: violet spike with a sage stem, slightly diagonal. |
| `item.daisy_bundle` | `item_daisy_bundle.png` | 64×64 | Three daisies tied with a coral twine bow. |
| `item.lavender_sachet` | `item_lavender_sachet.png` | 64×64 | Small cream muslin pouch tied with lavender ribbon, a sprig tucked in. |
| `item.mixed_bouquet` | `item_mixed_bouquet.png` | 64×64 | Kraft-paper cone with daisies and lavender fanned out, pink ribbon. The most "finished" looking item. |

The same item files are used as icons in the orders panel and inspector at 32 px and 48 px, so silhouettes must survive downscaling.

## 6. Status badges and tile overlays

Badges float at the top-right of a tile and must be readable **by shape, not just color**.

| Key | File | Canvas | Description |
| --- | --- | --- | --- |
| `badge.blocked` | `badge_blocked.png` | 64×64 | Coral rounded pennant with a cream "!" — output blocked. |
| `badge.waiting` | `badge_waiting.png` | 64×64 | Lavender rounded pennant with a cream "…" — waiting for inputs. |
| `badge.ready` | `badge_ready.png` | 64×64 | Honey rounded pennant with a cream check mark — output ready. |
| `badge.wrong` | `badge_wrong.png` | 64×64 | Coral pennant with a cream "×" — item refused (no matching recipe / wrong item). |
| `tile.valid` | `tile_valid.png` | 128×128 | Soft sage ring with painted corners marking a valid placement. |
| `tile.invalid` | `tile_invalid.png` | 128×128 | Soft coral ring with a faint cross hatch marking an invalid placement. |
| `tile.select` | `tile_select.png` | 128×128 | Honey ring with corner ticks marking the selected structure. |

## 7. UI icons (HUD, build palette, buttons)

Flat-ish painted icons on transparent background, 96×96 source (shown at 24–48 px). Ink `#39463B` strokes with a single accent fill each.

| Key | File | Description |
| --- | --- | --- |
| `ui.coin` | `ui_coin.png` | Honey coin with a tiny petal emboss. |
| `ui.order` | `ui_order.png` | Rolled cream order slip with a pink wax seal. |
| `ui.pause` | `ui_pause.png` | Two rounded bars. |
| `ui.play` | `ui_play.png` | Rounded triangle. |
| `ui.fast` | `ui_fast.png` | Two rounded triangles. |
| `ui.rotate` | `ui_rotate.png` | Curved arrow. |
| `ui.remove` | `ui_remove.png` | Small garden trowel with a coral tip. |
| `ui.undo` | `ui_undo.png` | Left-hooking arrow. |
| `ui.settings` | `ui_settings.png` | Flower-shaped cog. |
| `ui.sound_on` / `ui.sound_off` | `ui_sound_on.png`, `ui_sound_off.png` | Bell / bell with a soft slash. |
| `ui.music_on` / `ui.music_off` | `ui_music_on.png`, `ui_music_off.png` | Note / note with slash. |
| `ui.help` | `ui_help.png` | "?" in a petal. |
| `ui.basket` | `ui_basket.png` | Small wicker basket (recoverable items from removed structures). |
| `ui.expand` | `ui_expand.png` | Four outward arrows around a sprout. |
| `ui.check` | `ui_check.png` | Check mark in a sage circle (order complete). |

Build palette thumbnails reuse the `idle` / `ready` machine and bed sprites; no separate icons are needed.

## 8. Decorative accents (no occupancy, placed on hedge border or lawn corners)

| Key | File | Canvas | Description |
| --- | --- | --- | --- |
| `decor.stone.0` | `decor_stone_0.png` | 64×64 | Two smooth grey-sage stones. |
| `decor.tuft.0` | `decor_tuft_0.png` | 64×64 | Tall grass tuft. |
| `decor.mushroom.0` | `decor_mushroom_0.png` | 64×64 | Tiny cream mushroom pair. |
| `decor.wildflower.0` | `decor_wildflower_0.png` | 64×64 | Three pink/coral wildflowers. |
| `decor.watering_can` | `decor_watering_can.png` | 128×128 | Honey-colored watering can, resting on the lawn edge. |
| `decor.terracotta` | `decor_terracotta.png` | 128×128 | A stacked pair of empty terracotta pots. |

## 9. Effects

| Key | File | Canvas | Description |
| --- | --- | --- | --- |
| `fx.sparkle` | `fx_sparkle.png` | 32×32 | Soft four-point cream sparkle (particle, additive-safe, no dark edges). |
| `fx.petal.daisy` | `fx_petal_daisy.png` | 32×32 | Single cream petal for completion confetti. |
| `fx.petal.pink` | `fx_petal_pink.png` | 32×32 | Single pink petal. |
| `fx.petal.lavender` | `fx_petal_lavender.png` | 32×32 | Single lavender petal. |
| `fx.ring` | `fx_ring.png` | 128×128 | Soft cream ring that scales and fades when a product pops out. |

## 10. Priority order for the art agent

1. `ground.grass.0–3`, `edge.hedge.*` (the whole screen is this)
2. `belt.straight`, `belt.corner.cw`, `belt.corner.ccw`, `belt.end`
3. `bed.daisy.e.*` then other facings; `item.daisy`, `item.daisy_bundle`
4. `machine.bundling.e.*`, `machine.packing.*`
5. Badges and tile overlays
6. `bed.lavender.*`, `machine.drying.*`, `machine.arrangement.*`, remaining items
7. UI icons, decor, effects

## 11. Audio (for the audio agent, optional)

Short mono OGG + MP3 in `assets/audio/`, -14 LUFS-ish, no tails longer than 1.2 s unless noted: `place.ogg` (soft wooden tap), `rotate.ogg` (tiny click), `remove.ogg` (soft brush), `invalid.ogg` (gentle dull thud, not a buzzer), `pop.ogg` (product finished: tiny bubble pop), `deliver.ogg` (item into packing: paper rustle), `order_complete.ogg` (warm 3-note chime, ~1.5 s), `unlock.ogg` (sparkle run-up, ~1 s), `ui_click.ogg`, `ambient_garden.ogg` (90 s loop: birds, breeze, very quiet).

## 12. Checklist for every delivered file

- [ ] Correct canvas size, transparent background, PNG-8-alpha or lossless WebP
- [ ] Top-down, light top-left, shadow down-right at the shared offset
- [ ] Palette-adjacent colors, visible against grass and belt
- [ ] Exact file name from this document
- [ ] Animation frames align pixel-perfectly across the loop
