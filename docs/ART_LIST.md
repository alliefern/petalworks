# Petalworks art list

Every picture file the game loads: 187 PNGs, with exact filenames, sizes, versions, what each one does, and the rules that keep them working in the game. Written Sun 1 Nov 2026 from the asset spec (`docs/ASSET_SPECS.md`), Codex's delivery list and today's game code.

## Contents

- [How to use this list](#how-to-use-this-list)
- [Rules for every file](#rules-for-every-file)
- [Palette](#palette)
- [Rules that keep the art working](#rules-that-keep-the-art-working)
- [Ground and edges (13)](#ground-and-edges)
- [Flower beds (32)](#flower-beds)
- [Belts (25)](#belts)
- [Machines (77)](#machines)
- [Items (5)](#items)
- [Status flags (4)](#status-flags)
- [Tile highlights (3)](#tile-highlights)
- [Decorations (6)](#decorations)
- [Effects (5)](#effects)
- [UI icons (17)](#ui-icons)
- [Title and logo](#title-and-logo)
- [Totals](#totals)
- [Where Codex's set falls short](#where-codexs-set-falls-short)
- [Where the docs disagree](#where-the-docs-disagree)

## How to use this list

The game loads 187 PNG files, and each one has a fixed filename and pixel size. To swap in your version, save it with exactly the same filename and size, then either drop it into the `assets/art/` folder of the alliefern/petalworks repo on GitHub or send it to me and I'll put it in. The game picks it up with no code changes. You can replace files one at a time, in any order, and anything you haven't redone keeps showing Codex's version.

Every size in this file is the size you draw at, which is twice what shows on screen. The game shrinks everything by half, so a 128 px grass tile shows as 64 px. Animated things have one file per frame, numbered from 0.

> **Good news before you start:** The spec and Codex's delivery match exactly. All 187 names and sizes line up, and the 187 files in the game today are the same set. The only disagreements are between the spec and the accessibility plan, and between the spec and what today's game code actually uses. Those are flagged in the sections below and collected at the bottom of this file.

## Rules for every file

| Rule | What to do |
| --- | --- |
| Tile size | One grid tile is 64 x 64 px on screen. Draw it at 128 x 128 px. The game halves it, so keep edges crisp. |
| Bigger canvases | Beds and machines sit on one tile but use a 144 x 144 canvas, which gives 8 px of extra room on every side for shadow and leaves spilling over the edge. Center the object in that canvas. They show at 72 x 72 on screen. |
| View | True top-down, looking straight down, with no tilt. Show height only with shading and shadow. A visible side face should never be taller than about 8 px at draw size. |
| Light | Always from the top left. Highlights go upper left, shadows lower right, at the same angle on every sprite. |
| Shadows | Soft and painted into the sprite. Ink `#39463B` at 25 to 35% opacity, shifted 4 to 6 px down and to the right, blurred about 4 px. A shadow may spill up to 8 px past the tile edge. |
| Background | Transparent PNG with a full alpha channel (RGBA, 8 bits per channel, which is what Codex delivered). The spec also accepts lossless WebP. The five ground tiles are the exception: grass and the locked plot fill their whole canvas and have no transparency. |
| Style | Painterly storybook gouache: soft but rich color, textured edges, light paper grain inside shapes, warm highlights, gentle shadows. Avoid glossy plastic, clean vector shapes, neon, glow, and outlines thicker than about 3 px. |
| Edges | No inked outlines. Use a darker painted edge of about 2 px where forms meet, kept the same weight across all sprites. |
| Animation | One file per frame, numbered from 0, for example `belt_straight_0.png` to `belt_straight_7.png`. No sprite sheets; the build packs them. |
| Filenames | Lowercase, words joined by underscores, ending in `.png`. The pattern is category, then name, then facing, then state, for example `bed_daisy_e_ready.png`. Copy names from this file exactly. |
| Facing letters | `n`, `e`, `s`, `w` mean the side a bed's or machine's output leaves from: `n` is the top of the screen, `e` the right, `s` the bottom, `w` the left. In the game's own words these show as up, right, down, left. |
| Readability | Anything that rides a belt has to stand out against both the green grass and the cream belt. |

## Palette

From the brief. It's a starting point, and saturation can shift for readability.

| Name | Hex | Where the spec uses it |
| --- | --- | --- |
| Cream | `#F6EBD5` | Belt canvas, daisy petals, packing paper, sparkles, the ring effect |
| Sage | `#A8B99A` | Grass, belt chevrons, stems, hedge highlights, the valid ring |
| Moss | `#657C58` | Grass shading, the hedge body |
| Petal pink | `#E9A8AF` | Wildflowers, the bouquet ribbon, the wax seal on the order icon, the pink petal |
| Coral | `#D77F70` | Bundling twine, the blocked and wrong flags, the invalid ring, the trowel tip |
| Lavender | `#B7A4CE` | Lavender spikes, the sachet ribbon, the arrangement cloth, the waiting flag |
| Honey | `#DDB66C` | Daisy centers, the coin, the watering can, the wax stamp, the ready flag, the select ring |
| Ink | `#39463B` | Shadows, UI icon strokes, and everything the game draws in code on top of your art |

Two more families sit outside the eight colors. Wood is a warm honey-brown family, and soil is a deep warm umber, never black.

## Rules that keep the art working

Break one of these and the garden shows seams, jumps, or pieces that don't connect.

| Rule | Applies to | Details |
| --- | --- | --- |
| Grass edges match | `ground_grass_0` to `3`, `ground_locked` | Any grass tile can sit next to any other, in any arrangement, without a visible seam. Codex gave all four grass tiles the same 16 px border so opposite edges match pixel for pixel. The game scatters them at random: about 72% tile 0, 12% tile 1, 10% tile 2 and 6% tile 3, so tile 0 carries the lawn. |
| Hedges repeat along their side | `edge_hedge_*` | The `n` and `s` strips repeat left to right; the `e` and `w` strips repeat top to bottom. Each corner piece has to join both strips it touches. The hedge fills the outer 60% of its tile and lawn fills the rest. |
| Belt ports line up | `belt_*` | Every belt enters and exits at the exact center of a tile edge, and the belt is the same width on every piece, so straights and corners connect in any rotation. |
| Belt rails stay still | `belt_*` frames | Across all 8 frames, only the chevrons move. The rails and rollers stay identical, pixel for pixel. |
| Chevrons loop | `belt_*` frames | Chevrons move forward 1/8 of their spacing each frame, so frame 7 flows back into frame 0 without a jump. Codex spaced them 32 px apart and moved them 4 px per frame. If you change the spacing, keep the step at exactly one eighth of it. |
| Bodies stay put between frames | Beds and machines | The box, table, bench or crate sits in exactly the same spot in every state and frame. Only the parts that animate or grow change. Frames have to line up pixel for pixel or the machine will wobble. |
| Facings repaint, they don't rotate | Beds and machines | Keep the body painting the same in all four facings and move only the output chute or tray. Rotating the whole picture would put the light in the wrong corner. Codex did it this way. |
| Leave room for what the game draws | Beds, machines, belts, items, flags | The game draws a small ink arrow (14 x 12 px on screen) on the exit edge of every bed, machine and belt, a cream status disc over the top-right corner of a tile, and a 1 px ink outline around every item. Don't paint copies of these. |

## Ground and edges

13 files, all 128 x 128. This is most of the screen.

| Files | Count | What it is | When the player sees it |
| --- | ---: | --- | --- |
| `ground_grass_0.png` | 1 | Base lawn: mottled sage and moss gouache with faint paper grain. | Every open tile of the garden, which is 16 x 12 tiles at the start and 20 x 14 after the expansion. |
| `ground_grass_1.png` | 1 | Same lawn with a few painted blades or a small clover tuft. | Mixed in at random. |
| `ground_grass_2.png` | 1 | Same lawn with two or three tiny pink or cream wildflower dots. | Mixed in at random. |
| `ground_grass_3.png` | 1 | Same lawn with a small smooth stone. | Mixed in at random, least often. |
| `edge_hedge_n.png`, `edge_hedge_s.png`, `edge_hedge_e.png`, `edge_hedge_w.png` | 4 | Hedge strips: clipped boxwood or a leafy hedge, moss with sage highlights at the top left. `n` has the hedge in the upper 60% of the tile, `s` the lower 60%, `e` the right 60%, `w` the left 60%. | A ring of hedge one tile outside the garden, all the way around. |
| `edge_hedge_ne.png`, `edge_hedge_nw.png`, `edge_hedge_se.png`, `edge_hedge_sw.png` | 4 | Outer corners that join two strips, for example `ne` joins the north and east strips. | The four corners of the hedge ring. |
| `ground_locked.png` | 1 | An unopened plot: wilder, longer grass, a little darker and less saturated, with a dotted painted twine edge. Must tile without seams. | The extra ground of the 20 x 14 expansion, before the player buys it. |

> **Flag:** The spec asks for painted twine on the locked plot. The accessibility plan says the darker grass alone isn't enough contrast (moss on sage is 2.20:1) and asks for the twine to be drawn in ink, so ink twine is the safer choice.

## Flower beds

32 files, all 144 x 144. Pattern: `bed_<flower>_<facing>_<state>.png`

Each bed is a low wooden planter box filled with soil, sitting on one tile. On its facing side there's a tiny wooden chute or lip where flowers leave onto a belt. There are 2 flowers x 4 facings x 4 growth states, which makes 16 files per flower. The build bar uses `bed_daisy_e_ready.png` and `bed_lavender_e_ready.png` as the bed buttons.

| State | What it shows | When the player sees it |
| --- | --- | --- |
| `empty` | Soil only, with a seed divot | Right after a flower leaves the bed |
| `grow0` | Sprouts | Early growth |
| `grow1` | Buds | Late growth |
| `ready` | Open flowers in full bloom. The game adds a slight bounce. | The flower is ready to leave |

| Bed | Files | Look |
| --- | --- | --- |
| Daisy Bed | `bed_daisy_n_empty.png` ... `bed_daisy_w_ready.png` (16) | Pale honey wood box, warm soil. Daisies with cream petals and honey centers, 3 to 5 blooms when ready. |
| Lavender Bed | `bed_lavender_n_empty.png` ... `bed_lavender_w_ready.png` (16) | Slightly grayer, weathered wood. Lavender spikes in `#B7A4CE` with a deeper violet shade and sage stems, 4 to 6 spikes when ready. |

Full file list for each flower (replace `<flower>` with `daisy` or `lavender`):

| Facing | Files |
| --- | --- |
| `n` | `bed_<flower>_n_empty.png`, `bed_<flower>_n_grow0.png`, `bed_<flower>_n_grow1.png`, `bed_<flower>_n_ready.png` |
| `e` | `bed_<flower>_e_empty.png`, `bed_<flower>_e_grow0.png`, `bed_<flower>_e_grow1.png`, `bed_<flower>_e_ready.png` |
| `s` | `bed_<flower>_s_empty.png`, `bed_<flower>_s_grow0.png`, `bed_<flower>_s_grow1.png`, `bed_<flower>_s_ready.png` |
| `w` | `bed_<flower>_w_empty.png`, `bed_<flower>_w_grow0.png`, `bed_<flower>_w_grow1.png`, `bed_<flower>_w_ready.png` |

- Keep the box shape identical for both flowers, so players read "bed" first and "which flower" second. The plant does the telling apart: round daisy heads against upright lavender spikes.
- There's no blocked picture. When a bed can't send its flower out, the game puts a status disc over the ready picture.
- If you're short on time, do the `e` (right-facing) set first. The game will turn it for the other three directions until those arrive, with the light slightly off.

## Belts

25 files, all 128 x 128.

Flat garden conveyors: a pale cream canvas strip with tiny stitched honey-brown rollers along the sides, and painted sage chevrons that point the way things travel. The chevrons crawl as the game cycles the frames. You paint one direction of each piece and the game turns it for the others. A belt can also be fed from behind or from either side, and there's no separate merge piece.

| Files | Frames | Direction you paint | What it does |
| --- | ---: | --- | --- |
| `belt_straight_0.png` to `belt_straight_7.png` | 8 | Enters on the left (west), exits on the right (east) | Every straight belt in the garden. Its first frame is also the belt button in the build bar. |
| `belt_corner_cw_0.png` to `belt_corner_cw_7.png` | 8 | Enters on the left (west), exits at the bottom (south) | A clockwise turn. |
| `belt_corner_ccw_0.png` to `belt_corner_ccw_7.png` | 8 | Enters on the left (west), exits at the top (north) | A counter-clockwise turn. |
| `belt_end.png` | 1 | A small end-stop bumper on the right (east) edge, nothing else | Laid over a belt whose next tile is empty, so dead ends are easy to spot. |

## Machines

77 files, all 144 x 144. Pattern: `machine_<name>_<facing>_<state>.png`

Machines take items in from any belt that points into them and send their product out only on the facing side, where a small wooden tray or chute is painted. The three crafting machines each have 4 facings x 6 states (`idle`, `work0`, `work1`, `work2`, `work3`, `ready`), which is 24 files each. The Packing Station has no facing and 5 files. The build bar uses each machine's `e` idle picture, and packing idle, as its button.

| State | What it shows |
| --- | --- |
| `idle` | The machine at rest with an empty tray |
| `work0` to `work3` | A 4-frame loop that plays while it's making something |
| `ready` | The finished product sitting on the output tray |

| Machine | Files | Look | Work animation | Ready | Shape to protect |
| --- | --- | --- | --- | --- | --- |
| Bundling Table (2 daisies into a bundle) | `machine_bundling_{n,e,s,w}_{idle, work0-3, ready}.png` (24) | Round-cornered honey-wood table, a big spool of coral twine, a pair of brass snips | The twine spool turns and a ribbon loops | A finished tied bundle on the tray | Round top, spool of twine |
| Drying Bench (2 lavender into a sachet) | `machine_drying_{n,e,s,w}_{idle, work0-3, ready}.png` (24) | Weathered sage-gray bench with a small rack of lavender bunches hanging upside down, and a muslin pouch | The bunches sway and dust drifts | A sachet on the tray | Rack with bunches hanging down |
| Arrangement Table (a bundle and a sachet into a bouquet) | `machine_arrangement_{n,e,s,w}_{idle, work0-3, ready}.png` (24) | Cream-painted round table, lavender cloth, a short vase, scattered petals, a roll of kraft paper | No hands: stems lift into the vase one by one | A wrapped bouquet on the tray | Round top, vase |
| Packing Station (ships finished goods) | `machine_packing_idle.png`, `machine_packing_receive0.png` to `machine_packing_receive3.png` (5) | Open wooden crate lined with cream paper, a stack of flat boxes, a little honey wax-seal stamp, a hanging tag | `receive0` to `receive3` play when an item arrives: the lid flap flutters and the tag swings | None. It takes items from every side and sends nothing out. | Open crate and a hanging tag |

Full file list for each crafting machine (replace `<name>` with `bundling`, `drying` or `arrangement`):

| Facing | Files |
| --- | --- |
| `n` | `machine_<name>_n_idle.png`, `machine_<name>_n_work0.png`, `machine_<name>_n_work1.png`, `machine_<name>_n_work2.png`, `machine_<name>_n_work3.png`, `machine_<name>_n_ready.png` |
| `e` | `machine_<name>_e_idle.png`, `machine_<name>_e_work0.png`, `machine_<name>_e_work1.png`, `machine_<name>_e_work2.png`, `machine_<name>_e_work3.png`, `machine_<name>_e_ready.png` |
| `s` | `machine_<name>_s_idle.png`, `machine_<name>_s_work0.png`, `machine_<name>_s_work1.png`, `machine_<name>_s_work2.png`, `machine_<name>_s_work3.png`, `machine_<name>_s_ready.png` |
| `w` | `machine_<name>_w_idle.png`, `machine_<name>_w_work0.png`, `machine_<name>_w_work1.png`, `machine_<name>_w_work2.png`, `machine_<name>_w_work3.png`, `machine_<name>_w_ready.png` |

Packing Station files: `machine_packing_idle.png`, `machine_packing_receive0.png`, `machine_packing_receive1.png`, `machine_packing_receive2.png`, `machine_packing_receive3.png`.

The Bundling Table and Arrangement Table both have round tops, so the spool and the vase are what tell them apart at 72 px. Same as the beds: if time is short, paint the `e` facing first and the game will turn it.

## Items

5 files, all 64 x 64.

Items are the things that ride the belts. Paint each one centered on its 64 x 64 canvas with its own tiny soft shadow. On belts they show at 32 px. The same files double as icons in the order card, the inspector and the build bar at roughly 20 to 56 px, and the title screen shows the daisy, the sachet and the bouquet at 56 px. The game adds a 1 px ink outline behind each item so it stands out on the cream belt, so don't paint a heavy outline yourself.

| File | What it is | Look | Shape that has to survive at small size |
| --- | --- | --- | --- |
| `item_daisy.png` | Daisy, from a Daisy Bed | A single daisy seen from above: 8 to 10 cream petals, a honey center, a hint of sage stem peeking out | Round bloom, round center |
| `item_lavender.png` | Lavender, from a Lavender Bed | A single sprig: violet spike, sage stem, slightly diagonal | Long diagonal spike |
| `item_daisy_bundle.png` | Daisy Bundle, from the Bundling Table | Three daisies tied with a coral twine bow | Three blooms and a bow knot |
| `item_lavender_sachet.png` | Lavender Sachet, from the Drying Bench | A small cream muslin pouch tied with lavender ribbon, with a sprig tucked in | Rectangular pouch, knot at the top |
| `item_mixed_bouquet.png` | Mixed Bouquet, from the Arrangement Table | A kraft-paper cone with daisies and lavender fanned out and a pink ribbon. It should look the most finished. | Cone, wide at the flower end |

The contrast numbers explain the outline: cream petals on a cream belt are close to 1:1, and a lavender sprig on sage grass is 1.09:1.

## Status flags

4 files, all 64 x 64.

A small pennant floats at the top-right corner of a bed or machine to show its status, bobbing gently. It shows at 32 x 32 on screen. On top of it, the game draws its own cream disc with an ink border and an ink symbol, 28 px across, sitting 4 px above the pennant's center. On your 64 x 64 canvas, that disc covers a circle about 56 px wide centered at x 32, y 24. Only the bottom strip and the corners of your flag show around it, and the accessibility plan says the game may leave the pennant out entirely if it crowds the flower.

| File | Pennant color in the spec | Symbol the game draws on its disc | What it means |
| --- | --- | --- | --- |
| `badge_blocked.png` | Coral | ! | Blocked: the product can't leave (next tile full, facing grass, belt dead end, input full) |
| `badge_waiting.png` | Lavender | Three dots | Waiting for ingredients |
| `badge_ready.png` | Honey | Check mark | The product is ready to leave |
| `badge_wrong.png` | Coral | x | Wrong item: the machine can't use what it was given |

- Paint no symbol on the flag. The spec asks for cream symbols painted on the pennants, but the accessibility plan replaced them: cream on coral, lavender and honey is only 1.62 to 2.48:1, under the 3:1 minimum. The game now draws the ink symbol on its disc, so a painted one would be hidden or clash.
- Keep the upper part of the flag plain so the disc sits cleanly over it.
- Flags have to be readable by shape, not only color. Blocked and wrong share coral in the spec, and coral and honey are only 1.53:1 apart, so color alone won't separate them.

## Tile highlights

3 files, all 128 x 128.

| File | Spec look | Shape the accessibility plan asks for | When the player sees it |
| --- | --- | --- | --- |
| `tile_valid.png` | Soft sage ring with painted corners | Four open corner brackets in ink, empty middle | Hovering a tile where the chosen piece can go |
| `tile_invalid.png` | Soft coral ring with a faint crosshatch | The same brackets plus an X across the tile | Hovering a tile where it can't go |
| `tile_select.png` | Honey ring with corner ticks | Four solid corner ticks, thicker than the valid brackets | Around the piece the player has clicked |

> **Flag:** Today's game doesn't load these three files. It draws its own rings in code: a sage ring with ink brackets, a coral ring with brackets and an ink X, a honey ring with thick ink ticks, plus a fourth dashed ink ring for the keyboard cursor that has no file at all. If you paint these, follow the bracket shapes, and Claude will need to switch the game over to your files.

## Decorations

6 files. Nothing can be built on them and they don't block anything.

| File | Size | Look | Where it sits |
| --- | --- | --- | --- |
| `decor_stone_0.png` | 64 x 64 | Two smooth gray-sage stones | Shown at 32 px near the hedge and lawn corners |
| `decor_tuft_0.png` | 64 x 64 | A tall grass tuft | Same, used in two spots |
| `decor_mushroom_0.png` | 64 x 64 | A tiny cream mushroom pair | Same |
| `decor_wildflower_0.png` | 64 x 64 | Three pink and coral wildflowers | Same, used in two spots |
| `decor_watering_can.png` | 128 x 128 | A honey-colored watering can resting on the lawn edge | The bottom-right corner of the hedge |
| `decor_terracotta.png` | 128 x 128 | A stacked pair of empty terracotta pots | The bottom-left corner of the hedge |

## Effects

5 files.

| File | Size | Look | When the player sees it |
| --- | --- | --- | --- |
| `fx_sparkle.png` | 32 x 32 | A soft four-point cream sparkle with no dark edges, since it gets layered brightly | Particle bursts |
| `fx_petal_pink.png` | 32 x 32 | A single pink petal | Confetti when something completes |
| `fx_petal_daisy.png` | 32 x 32 | A single cream petal | Completion confetti in the spec. Today's game doesn't load it yet. |
| `fx_petal_lavender.png` | 32 x 32 | A single lavender petal | Completion confetti in the spec. Today's game doesn't load it yet. |
| `fx_ring.png` | 128 x 128 | A soft cream ring | When a product pops out, it grows from about half a tile to about one and a half tiles and fades in under half a second |

## UI icons

17 files, all 96 x 96.

Mostly flat painted icons on a transparent background, with ink `#39463B` strokes and a single accent color each. They show small, from 14 px (the coin next to prices) up to 40 px, so test every one at its smallest size.

| File | Look | Where it shows today |
| --- | --- | --- |
| `ui_coin.png` | Honey coin with a tiny petal emboss | Top bar, prices in the build bar, order rewards (14 to 28 px) |
| `ui_order.png` | Rolled cream order slip with a pink wax seal | Top bar and order card |
| `ui_pause.png` | Two rounded bars | Top bar pause button |
| `ui_play.png` | Rounded triangle | Top bar, swaps in while paused |
| `ui_fast.png` | Two rounded triangles | Not loaded by today's game |
| `ui_rotate.png` | Curved arrow | Inspector rotate button |
| `ui_remove.png` | Small garden trowel with a coral tip | Build bar remove tool (40 px) and inspector remove button |
| `ui_undo.png` | Left-hooking arrow | Top bar |
| `ui_settings.png` | Flower-shaped cog | Top bar |
| `ui_sound_on.png` | Bell | Not loaded by today's game |
| `ui_sound_off.png` | Bell with a soft slash | Not loaded by today's game |
| `ui_music_on.png` | Music note | Not loaded by today's game |
| `ui_music_off.png` | Music note with a slash | Not loaded by today's game |
| `ui_help.png` | A question mark in a petal | Top bar |
| `ui_basket.png` | Small wicker basket | Build bar: items recovered from removed pieces |
| `ui_expand.png` | Four outward arrows around a sprout | Build bar: buying the bigger garden (40 px) |
| `ui_check.png` | Check mark in a sage circle | Order complete card (40 px) and the free-play heading |

Build bar buttons for beds, belts and machines reuse their in-game pictures, so they need no separate icons.

## Title and logo

The spec has no title art or logo file. Today's title screen sets the name Petalworks in type and shows three item sprites above it (the daisy, the bouquet and the sachet). If you design a logo, Claude will need to add a slot for it, and I can ask for that whenever you're ready.

## Totals

187 files in all. Machines are the biggest group at 77 files (41% of the set), then flower beds (32) and belts (25).

| Category | Files | Draw size | Unique pictures to design |
| --- | ---: | --- | --- |
| Ground and edges | 13 | 128 x 128 | 4 grass, 4 hedge strips, 4 hedge corners, 1 locked plot |
| Flower beds | 32 | 144 x 144 | 2 beds x 4 growth states, each in 4 facings |
| Belts | 25 | 128 x 128 | 3 belt pieces x 8 frames, plus 1 end stop |
| Machines | 77 | 144 x 144 | 3 machines x 6 states x 4 facings, plus a 5-frame packing station |
| Items | 5 | 64 x 64 | 5 items |
| Status flags | 4 | 64 x 64 | 4 flags |
| Tile highlights | 3 | 128 x 128 | 3 rings (not used by today's game) |
| Decorations | 6 | 64 x 64 and 128 x 128 | 4 small, 2 large |
| Effects | 5 | 32 x 32 and 128 x 128 | 4 particles, 1 ring |
| UI icons | 17 | 96 x 96 | 17 icons |
| **Total** | **187** | | |

Facings and frames make the count look bigger than the drawing work is. The 77 machine files come from 4 machine designs, and each belt piece is one design shown in 8 positions.

## Where Codex's set falls short

From Codex's own delivery notes. This is where your redesign has the most room.

1. Machine animation is light. Codex moved painted parts around instead of painting each frame. The bundling spool turns but there's no full twine loop, the drying bunches sway with no drifting dust, and the packing crate moves its paper and tag instead of a clearly hinged lid flap.
2. The drying rack suggests a bit more height than a flat top-down view should.
3. Some highlights, on the coin and the bells for example, and some leaf detail are more modeled and busier than the quiet gouache look the spec wants.
4. The small ready products on machine trays and the faint placement rings need a check for how well they read in the game.
5. The locked plot's twine edge was rebuilt by script after a cropping fix, so it's a good candidate for a fresh painting.

## Where the docs disagree

| Topic | What's going on |
| --- | --- |
| Spec vs Codex's delivery | Match: 187 of 187 names and sizes. |
| Status flags | The spec paints cream symbols on the flags. The accessibility plan and today's game draw an ink symbol on a cream disc instead, so paint no symbol and keep the top of the flag clear. |
| Tile highlights | The spec lists three ring files. Today's game draws its rings in code and doesn't load the files. |
| Locked plot | The spec says painted twine. The accessibility plan says ink twine. |
| Files the game doesn't load yet | `tile_valid`, `tile_invalid`, `tile_select`, `fx_petal_daisy`, `fx_petal_lavender`, `ui_fast`, `ui_sound_on`, `ui_sound_off`, `ui_music_on`, `ui_music_off`. They're still in the spec, so it's worth drawing them, but they're the lowest priority. |
| File format wording | The spec's checklist says "PNG-8-alpha" but its rules table says 8-bit alpha. Codex delivered full-color RGBA PNGs with an 8-bit alpha channel, and the game loads those fine, so match that. |
