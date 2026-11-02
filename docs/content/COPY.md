# Petalworks copy (first-pass slice)

Player-facing text for the first six orders. The strings live in [`copy.json`](copy.json). Use those keys in the UI. This file is the same text, in reading order, for review.

American English. The player is the operator of the workshop. Orders and tools speak to them directly.

Sentences use sentence case. Title case is for screen titles and the names of buildings and goods: Daisy Bed, Belt, Bundling Table, Lavender Bed, Drying Bench, Arrangement Table, Packing Station, Daisy Bundle, Lavender Sachet, Mixed Bouquet, How to Play.

Tone to keep if you edit a line: warm, plain, a little wry. Short enough for a button, a tooltip, or a one-line tip. No timers, no scolding, no pile of pet names.

## How to drop this in

- Replace `{token}` with a value. Tokens in this file: `{coins}`, `{cost}`, `{count}`, `{current}`, `{total}`, `{have}`, `{need}`, `{item}`, `{takes}`, `{machine}`, `{target}`, `{facing}`, `{elapsed}`, `{seconds}`, `{customer}`, `{short}`, `{note}`, `{summary}`, `{n}`, `{done}`, `{what}`, `{x}`, `{y}`, `{name}`, `{cap}`, `{line}`. Speed buttons show `{n}×`. The Fast tooltip still says Fast.
- Plurals: `items.*.one` when the count is exactly 1, otherwise `items.*.other`. Lavender uses "Lavender" for both.
- Facing shown to the player is a screen direction: `n` up, `e` right, `s` down, `w` left. "Faces right."
- Times and prices come from the sim data. Copy never hardcodes 4 seconds or a coin price.
- Order counts are part of the sentences. If a count changes, change that order's `requirement`, `short`, `note` if it mentions a number, and the matching tutorial prompt.
- Show a string only when that control exists. A hidden building does not need its locked line.

## Voice notes

Say "workshop" and "garden" to the player. "Belt", "bed", and "order" are fine. The building names below are the on-screen names, including Packing Station.

Coins are coins. Removal refunds whatever the sim returns, via `{coins}`. These lines assume a full refund of the build cost, and any items on the structure go to the basket. If a refund is zero, do not show the refund line.

## Title screen

Browser tab: **Petalworks** (`title.metaTitle`)

**Petalworks** (`title.name`)
A cozy flower workshop. (`title.tagline`)

- **Continue** (`title.continue`). Under it, when a save exists: Back to your saved garden. (`title.continueHint`)
- **New Game** (`title.newGame`)
- **Settings** (`title.settings`)
- **How to Play** (`title.howToPlay`)

Footer: Your garden is saved on this device. (`title.savedHere`)
Small, once: Sound starts after your first click. (`title.soundHint`)

Hide Continue when there is no save. If there is no save, New Game starts immediately. If a save exists, New Game opens the confirm below.

### Start over

**Start a new game?** (`newGameConfirm.title`)
This erases your saved garden, coins, and orders. (`newGameConfirm.body`)

- **Start New Game** (`newGameConfirm.confirm`)
- **Cancel** (`newGameConfirm.cancel`)

Use this same confirm from the title screen and from Settings.

### Unreadable save

**Couldn't open that save** (`save.unreadableTitle`)
The saved garden can't be read. Start a new game to keep playing. (`save.unreadableBody`)

- **Start New Game** (`save.unreadableConfirm`)
- **Not now** (`save.unreadableCancel`)

Use this for a corrupt save and for a save the current build doesn't know how to migrate.

## Settings

**Settings** (`settings.title`)

- Sound effects (`settings.sound`): On / Off (`settings.on`, `settings.off`)
- Music (`settings.music`)
- Reduced motion (`settings.reducedMotion`). Turns down extra movement, and the garden keeps going. (`settings.reducedMotionHelp`)
- **How to Play** (`settings.howToPlay`)
- **Title screen** (`settings.backToTitle`). The garden is already saved. No extra confirm.
- **Close** (`settings.close`)

## How to play

**How to Play** (`howTo.title`)

You run the workshop. Place beds and machines and connect them with belts, so you can fill the order at the top. (`howTo.intro`)

Tips can be skipped. Open this panel any time to read them again. (`howTo.skipNote`)

Section titles: First order (`howTo.tipsTitle`), Later orders (`howTo.laterTitle`), Controls (`howTo.controlsTitle`).

The tip text is the tutorial prompts further down. Do not write a second set.

**Replay tips** (`howTo.replay`) starts the tips again from the current order.
**Close** (`howTo.close`)

### Controls

| Action | Input | Key |
| --- | --- | --- |
| Place or select | Left-click | `controls[place]` |
| Lay belts | Click and drag | `controls[belt]` |
| Rotate | R | `controls[rotate]` |
| Cancel | Esc or right-click | `controls[cancel]` |
| Undo last build | Z | `controls[undo]` |
| Remove | Remove tool | `controls[remove]` |
| Pan | Drag empty grass, or middle mouse | `controls[pan]` |
| Zoom | Mouse wheel | `controls[zoom]` |
| Pause or resume | Pause button | `controls[pause]` |
| Run faster | Fast button | `controls[fast]` |
| Move through buttons | Tab, then Enter | `controls[menus]` |

No key is listed that the game does not implement. Pause and Fast are buttons unless you bind keys, in which case update these rows. Keyboard rows beyond this table are under Leftover UI strings (`extra.controlsExtra`).

## Top bar

- Coins (`hud.coins`): `{coins}` (`hud.coinsValue`)
- Order (`hud.order`): customer (`hud.orderFor`), short need (`hud.orderShort`), progress `{have} / {need}` (`hud.orderProgress`)
- Longer progress, for the order card or a screen reader: Delivered {have} of {need} (`hud.orderDelivered`)
- Before any order exists, or if data is missing: No open order (`hud.noOrder`). After the sixth order, the order slot uses the sandbox line from Ending.
- **Pause** (`hud.pause`) / **Resume** (`hud.resume`). While paused: Paused (`hud.paused`). The garden is paused. (`hud.pausedDetail`)
- **Fast** (`hud.fast`). Tooltip while off: Run the garden a little faster. (`hud.fastTooltip`). Tooltip while on: Back to normal speed. (`hud.normalTooltip`)
- **Build** (`hud.build`). Show build menu / Hide build menu (`hud.buildShow`, `hud.buildHide`)
- **Undo** (`hud.undo`). Undo the last build. (`hud.undoTooltip`)
- **Rotate** (`hud.rotate`). Rotate, or press R. (`hud.rotateTooltip`)
- **Settings** (`hud.settings`)
- **How to Play** (`hud.help`)
- **Basket** (`hud.basket`)

Do not toast every daisy that arrives. The order count is the feedback.

Screen-reader names (`a11y`). Icon buttons use these. A settings row uses its visible label.

| Key | Spoken name |
| --- | --- |
| `a11y.game` | Petalworks garden |
| `a11y.buildPalette` | Build menu |
| `a11y.inspector` | Selected structure |
| `a11y.order` | Current order, {summary} |
| `a11y.orderSummary` | {customer} needs {short}. Reward: {coins} coins. {note} |
| `a11y.coins` | {coins} coins |
| `a11y.pause` | Pause the garden |
| `a11y.resume` | Resume the garden |
| `a11y.fastOn` | Fast speed, on |
| `a11y.fastOff` | Fast speed, off |
| `a11y.settings` | Settings |
| `a11y.help` | How to Play |
| `a11y.close` | Close |
| `a11y.undo` | Undo last build |
| `a11y.rotate` | Rotate |
| `a11y.remove` | Remove tool |
| `a11y.basket` | Basket, {count} items |
| `a11y.basketItem` | Place {item} from the basket |
| `a11y.soundOn` | Sound effects on |
| `a11y.soundOff` | Sound effects off |
| `a11y.musicOn` | Music on |
| `a11y.musicOff` | Music off |
| `a11y.reducedMotionOn` | Reduced motion on |
| `a11y.reducedMotionOff` | Reduced motion off |

## Build menu

**Build** (`palette.title`)

Groups, in this order: Grow, Move, Make, Pack, Tools (`palette.groups`).

Cost line on a hover card: `{cost} coins` (`palette.cost`).
If you show a building before it is available, gray it and use: Available later. (`palette.locked`). Prefer hiding it until `orders.*.unlocks` says it is available.

Hints under the menu, one at a time:

- Placing a bed or machine: Click grass to place it. R rotates, and Esc cancels. (`palette.hint.place`)
- Belt: Drag a path on grass. R rotates, and Esc cancels. (`palette.hint.belt`)
- Remove: Click a structure to pick it up, or Esc cancels. (`palette.hint.remove`)

### Buildings

| Name | Group | Tooltip | Inspector note |
| --- | --- | --- | --- |
| Daisy Bed | Grow | Grows one daisy at a time, from the side you aim. | Daisies leave one at a time from the side it faces. |
| Lavender Bed | Grow | Grows one sprig at a time, from the side you aim. Lavender takes longer than daisies. | Sprigs leave one at a time from the side it faces. |
| Belt | Move | Carries one item per tile, only in the direction it faces. | Holds one item, and the arrow shows which way it goes. |
| Bundling Table | Make | Ties 2 daisies into one Daisy Bundle. | Takes daisies from any side, and bundles leave the way it faces. |
| Drying Bench | Make | Dries 2 lavender into one Lavender Sachet. | Takes lavender from any side, and sachets leave the way it faces. |
| Arrangement Table | Make | Makes a Mixed Bouquet from one bundle and one sachet. | Takes a bundle and a sachet from any side, and bouquets leave the way it faces. |
| Packing Station | Pack | Takes deliveries and counts them toward the open order. | Takes a delivery from any side and counts it toward the order. Nothing comes back out. |

Keys: `palette.buildings.daisyBed`, `lavenderBed`, `belt`, `bundlingTable`, `dryingBench`, `arrangementTable`, `packingStation`. Each has `name`, `tooltip`, `inspector`, `group`, and `recipe`.

Corners are the same Belt tool. Rotate with R. The end bumper is not a placeable building.

**Remove** (`palette.tools.remove.name`), Tools group. Tooltip: Picks up a structure, and items on it go to the basket.

Available from the first moment: Daisy Bed, Belt, Packing Station, Remove.
Added when an order packs, in this order: Bundling Table, Lavender Bed, Drying Bench, Arrangement Table. See each order below. The JSON key is `unlocks`.

## Items

| Id | One | More than one |
| --- | --- | --- |
| `daisy` | Daisy | Daisies |
| `lavender` | Lavender | Lavender |
| `daisyBundle` | Daisy Bundle | Daisy Bundles |
| `lavenderSachet` | Lavender Sachet | Lavender Sachets |
| `mixedBouquet` | Mixed Bouquet | Mixed Bouquets |

## Recipes

Shown in the inspector. `{seconds}` comes from sim data.

| Id | Line |
| --- | --- |
| `daisy` | Grows 1 Daisy |
| `lavender` | Grows 1 Lavender |
| `daisyBundle` | 2 Daisies to 1 Daisy Bundle |
| `lavenderSachet` | 2 Lavender to 1 Lavender Sachet |
| `mixedBouquet` | 1 Daisy Bundle + 1 Lavender Sachet to 1 Mixed Bouquet |

Takes, makes, and time are split in `recipes.*.in`, `out`, and `time` ("{seconds} seconds"). Beds have no `in`.

## Status labels

The badge or status row uses `label`. The inspector can add `detail` under it. Status is never color alone.

Which label wins:

1. Output is ready but cannot leave: a Blocked reason, not Ready.
2. Output is ready and the next tile can take it: Ready.
3. The craft timer is running: Processing. If your sim pauses that timer because the next tile is full, show Blocked instead.
4. Still missing ingredients: Waiting for inputs, or the specific Waiting for line when at least one input is already in.
5. A bed with no flower ready: Growing. A blocked bed pauses. While it is paused, show Blocked, not Growing.

| Key | Label | Detail |
| --- | --- | --- |
| `states.growing` | Growing | Not ready yet. |
| `states.ready` | Ready | {item} can move on. |
| `states.processing` | Processing | Making {item}. |
| `states.waiting` | Waiting for inputs | Needs {takes}. |
| `states.waitingFor` | Waiting for {count} {item} | {have} of {need} so far. |

`{count}` in Waiting for is how many are still missing. Pluralize `{item}` from that count. Use `waiting` when nothing is in yet. Use `waitingFor` once the machine is holding part of the recipe (one daisy of two, or a bundle with the sachet still missing).

Blocked. Say the reason in the label:

| Key | Label | Detail |
| --- | --- | --- |
| `blocked.exitFull` | Blocked: no room ahead | The next tile is full, so this waits for an open space. |
| `blocked.noExit` | Blocked: nothing connected | Aim the output at a belt or a machine. |
| `blocked.wrongItem` | Blocked: won't take {item} | {machine} doesn't use {item}. Pick it up with Remove, and the item goes to the basket. |
| `blocked.inputFull` | Blocked: input is full | No room for more until this one finishes. |
| `blocked.beltEnd` | Blocked: belt ends here | Extend the belt, or aim it into a machine. |
| `blocked.refused` | Blocked: won't take {item} | {target} doesn't take {item}. Aim the belt somewhere that does. |

`wrongItem` is for an item already in the machine. `refused` is for an item still on the belt, with the machine declining it. `beltEnd` is the belt with no next tile.

Belts:

| Key | Label | Detail |
| --- | --- | --- |
| `states.belt.empty` | Empty | Items move {facing}. |
| `states.belt.carrying` | Carrying {item} | It's headed {facing}. |

A belt that cannot move uses the Blocked labels above (`exitFull`, `beltEnd`, `refused`).

Packing Station:

| Key | Label | Detail |
| --- | --- | --- |
| `states.packing.waiting` | Waiting for a delivery | Send finished goods here on a belt. |
| `states.packing.receiving` | Receiving | A delivery just arrived. |
| `states.packing.stored` | Stored | {count} {item} in here. |
| `states.packing.storedUnused` | Stored | No open order needs {item}, so it waits here. |

Packing stores the goods that arrive. It does not pull goods out of nowhere. Extra goods remain stored. There is no "crate full" line in this slice.

## Inspector

Nothing selected (`inspector.emptyTitle`). Click a bed, belt, or machine. (`inspector.emptyBody`)

Labels: Status, Recipe, Takes, Makes, Grows, Time, Progress, Inputs, Output, Holding, Sends, Stored (`inspector.labels`).

Values:

- Progress: `{elapsed}s of {total}s`
- An input row: `{have} / {need} {item}`
- Sends: Faces {facing}
- Holding: `{item}`, or Empty
- Stored: `{count} {item}`, or Nothing stored yet.

Beds use Grows, Time, Progress, Sends, and the bed's `inspector` note. Hide Takes.
Machines use Recipe (the `recipes.*.line`), Takes, Makes, Time, Progress, Inputs, Sends, and that machine's `inspector` note.
Belts use Status, Holding, Sends.
Packing uses Status and Stored. Hide Sends. Its note says nothing comes back out.

## When placement fails

One line, near the cursor or in the small notice area. Same line for a bad ghost and a bad click.

| Key | Line |
| --- | --- |
| `errors.occupied` | That tile already has something on it. |
| `errors.outside` | That spot is outside the garden. |
| `errors.lockedPlot` | That part of the garden is still closed. |
| `errors.hedge` | The hedge is a border. Build on open grass. |
| `errors.funds` | Not enough coins. This costs {cost}, and you have {coins}. |
| `errors.fundsPath` | Not enough coins to finish this path. |
| `errors.locked` | That one comes later. |
| `errors.rotateHolding` | Let {item} move off first, then turn it. |
| `errors.rotateOccupied` | Those tiles are taken, so it won't turn. |
| `errors.undoEmpty` | Nothing to undo yet. |
| `errors.undoUnsafe` | Undo would drop items, so nothing changed. |
| `errors.removeEmpty` | Nothing there to remove. |
| `errors.beltFull` | That belt is holding something. |
| `errors.basketPlace` | Put that on an empty belt. |
| `errors.dragSkipped` | The path skipped the full tiles. |

A 1×1 turn keeps the item on that tile. Use `rotateHolding` only if a turn would actually drop an item. Use `undoUnsafe` only if undo would destroy items. Do not use either as a default.

`dragSkipped` is a quiet note when a belt drag jumps over taken tiles and still places the free ones.

## Basket and removing

**Basket** (`basket.title`)
The basket is empty. (`basket.empty`)
Click an item, then an empty belt, to send it back out. (`basket.hint`)

After a remove, show only the lines that apply:

- `{item} went to the basket.` (`basket.removed`)
- Items went to the basket. (`basket.removedMany`) when more than one kind moved
- `You got {coins} coins back.` (`basket.refund`)

No confirm on remove. The items are safe, and the cost comes back. Do not toast "Removed" on top of these.

## Orders

Six orders, fixed sequence, keys `orders.order1` through `orders.order6`. Card labels: For (`orders.labels.from`), Needs (`orders.labels.needs`), Reward (`orders.labels.reward`).

Reward line on every card: Pays {coins} coins. Fill `{coins}` from sim data.

On complete, show at most three lines: `complete`, then "You earned {coins} coins." (`celebration.earned`), then `unlockLine` when the order has one. The order card changes to the next customer. After order 6, open Ending. There is no seventh order.

Do not toast each delivery.

### 1. Nell

Two loose daisies. I keep one glass by the sink.

- Needs: Deliver 2 Daisies (short: 2 Daisies)
- Reward: Pays {coins} coins
- Packed: Nell's daisies are packed.
- Adds the Bundling Table: You can build a Bundling Table now. Two daisies make one Daisy Bundle.

Teaches growing, belts, and shipping. Item `daisy`, count 2.

### 2. Otto

Bundle them, please. Loose stems make a mess of my satchel.

- Needs: Deliver 2 Daisy Bundles (short: 2 Daisy Bundles)
- Reward: Pays {coins} coins
- Packed: Otto's bundles are packed.
- No new building.

Teaches the Bundling Table. Item `daisyBundle`, count 2.

### 3. Hester

Four bundles for the counter. Saturday gets busy.

- Needs: Deliver 4 Daisy Bundles (short: 4 Daisy Bundles)
- Reward: Pays {coins} coins
- Packed: Hester's four bundles are packed.
- Adds the Lavender Bed: You can build a Lavender Bed now. It takes longer to grow than daisies.

Teaches a longer run. A second Daisy Bed is the intended fix. Saturday is flavor. There is no deadline. Item `daisyBundle`, count 4.

### 4. Ivo

Leave them loose. I'll take the sprigs as they are.

- Needs: Deliver 2 Lavender (short: 2 Lavender)
- Reward: Pays {coins} coins
- Packed: Ivo's lavender is packed.
- Adds the Drying Bench: You can build a Drying Bench now. Two lavender make one Lavender Sachet.

Teaches a second bed, shipped raw. Item `lavender`, count 2.

### 5. Pia

Two sachets for the linen shelf, when you have them.

- Needs: Deliver 2 Lavender Sachets (short: 2 Lavender Sachets)
- Reward: Pays {coins} coins
- Packed: Pia's sachets are packed.
- Adds the Arrangement Table: You can build an Arrangement Table now. A bundle and a sachet make one Mixed Bouquet.

Teaches the Drying Bench. Item `lavenderSachet`, count 2.

### 6. Ada

One bouquet for the table. Daisies and lavender together.

- Needs: Deliver 1 Mixed Bouquet (short: 1 Mixed Bouquet)
- Reward: Pays {coins} coins
- Packed: Ada's bouquet is packed.
- No new building. The ending plays when this order packs.

Teaches the two-input table. Item `mixedBouquet`, count 1.

## Ending

Show this when Ada's order packs. It is a short card on top of the garden.

**Orders complete** (`ending.title`)
All six orders are packed and paid. You can build more, or leave the belts running. (`ending.body`)

**Keep Building** (`ending.button`) closes the card. The garden is as they left it.

Where the order used to sit: No further orders to pack. (`ending.sandbox`)

No further orders are promised. Coins, buildings, and the grid remain. The player can keep placing anything already available.

## More garden

One optional expansion, from 16×12 to 20×14. Offer it when you want the extra room. A good moment is after Hester's order, or when the sandbox starts. If you never sell it, do not show the button. If you open it for free, show `expansion.opened` and skip the confirm.

**Open Plot** (`expansion.button`)
Tooltip: Open more grass to build on. (`expansion.tooltip`)
Before it is offered, if the closed grass is visible: More garden opens later. (`expansion.lockedHint`)

**Open the far plot?** (`expansion.confirmTitle`)
Adds grass past the current hedge. You can build on it right away. (`expansion.confirmBody`)

- This costs {cost} coins. (`expansion.confirmCost`) when it costs money
- It's free. (`expansion.confirmFree`) when it does not
- **Open Plot** (`expansion.confirmYes`)
- **Not now** (`expansion.confirmNo`)

Toast: The far plot is open. (`expansion.opened`)
If they are short: Not enough coins. Opening the plot costs {cost}, and you have {coins}. (`expansion.cantAfford`)

Closed grass uses `errors.lockedPlot`.

## Tips

Tips, one at a time, over the garden. Not a modal. Each one says what to do and why.

Chrome: Skip (`tutorial.skip`), Next (`tutorial.next`), Back (`tutorial.back`), Got it (`tutorial.gotIt`), Done (`tutorial.done`).
Step counter for the opening set only: Tip {current} of {total} (`tutorial.step`)

Skip hides the remaining opening tips and shows: Tips are hidden. Open How to Play to read them again. (`tutorial.skipped`)

Contextual tips still appear later, once each, because they belong to a new order. Skip on those dismisses that one tip. Hide a contextual tip when its order completes.

Drop `place-packing` if a Packing Station is already on the grass at the start.

### First order (in this order)

| Id | Prompt |
| --- | --- |
| `see-order` | Nell's order at the top is 2 daisies, and they count only when they reach the Packing Station. |
| `place-bed` | Open Build and place a Daisy Bed on open grass, where the daisies grow. Press R to aim the side they leave from. |
| `place-packing` | Choose Packing Station and place it a few tiles away. A daisy counts only if it arrives there. |
| `lay-belt` | Choose Belt and drag from the bed to the Packing Station. Each tile holds one item and moves it forward. |
| `turn-belt` | Press R to turn a belt. Keep the tiles touching, so each item has a next step. |
| `watch-flow` | Wait a few seconds for a daisy to move onto the belt. If it stops, the status line says why. |
| `fill-order` | Send 2 daisies to the Packing Station. The order updates on its own, then pays you. |
| `fix-mistakes` | Press Z to undo a build. Remove sends items to the basket, and Esc or right-click cancels. |

### Later orders (when that order becomes active)

| Id | When | Prompt |
| --- | --- | --- |
| `bundles` | `order2`, Otto | Otto wants Daisy Bundles, so place a Bundling Table on the belt path. It needs 2 daisies. |
| `more-bundles` | `order3`, Hester | Hester wants 4 bundles. Add a second Daisy Bed and belt it to the Bundling Table. |
| `lavender` | `order4`, Ivo | Ivo wants raw lavender, so place a Lavender Bed and belt it to the Packing Station. Lavender takes longer than daisies. |
| `sachets` | `order5`, Pia | Pia wants Lavender Sachets. A Drying Bench takes lavender in and sends sachets to the Packing Station. |
| `bouquet` | `order6`, Ada | Ada wants 1 Mixed Bouquet. Give an Arrangement Table one Daisy Bundle and one Lavender Sachet, then belt it to the Packing Station. |

`tutorial.contextual.*.orderId` matches the order key.

## Leftover UI strings

These lived in `EXTRA` in `src/ui/strings.ts`. They are under `extra` in `copy.json`, with the same key names, so that object can replace `EXTRA` later. `src/` stays as it is.

Sentence case. Short labels stay short. `{placeholders}` stay put.

### Settings

The garden is paused while Settings is open. (`extra.settings.paused`)

Taps, pops, and chimes. (`extra.settings.soundHelp`)

A quiet music-box tune. (`extra.settings.musicHelp`)

Tips (`extra.settings.tutorial`). Show the tips again from the start. (`extra.settings.tutorialHelp`)

Start over (`extra.settings.newGame`). This erases your saved garden, coins, and orders. (`extra.settings.newGameHelp`)

**New Game** (`extra.settings.newGameButton`). **Keep this garden** (`extra.settings.keep`). **Back to the garden** (`extra.settings.backToGarden`).

### Top bar

Orders (`extra.hud.orders`). Heading: Order {n} of {total} (`extra.hud.orderOf`). For {customer} (`extra.hud.forCustomer`).

Spoken count: {done} of {total} orders packed (`extra.hud.ordersDone`)

Speed (`extra.hud.speed`). The buttons read {n}× (`extra.hud.speedN`). Spoken: Speed {n} times (`extra.a11y.speedN`).

Zoom in (`extra.hud.zoomIn`). Zoom out (`extra.hud.zoomOut`). Fit (`extra.hud.fit`). Fit the garden on screen, or press Home. (`extra.hud.fitTooltip`)

Tips (`extra.hud.tips`). Open How to Play, or press H. (`extra.hud.tipsTooltip`)

Open market, on the order card and the ending card: Everything you deliver now sells for coins, and you can place every building. (`extra.hud.sandboxBody`)

### Screen reader

Arrow keys move the cursor. Press Enter to place or select. R rotates, and Esc cancels. (`extra.a11y.gameHelp`)

Notices (`extra.a11y.notices`). Skip to the garden (`extra.a11y.skipToGarden`). Empty grass (`extra.a11y.emptyTile`).

{what} at column {x}, row {y} (`extra.a11y.cursorTile`)

### Build hint and palette

Refund (`extra.palette.refund`), where a building would show its price.

Faces {facing} (`extra.palette.facing`). R rotates (`extra.palette.rotateHint`).

Click to place. (`extra.palette.clickToPlace`)

Release to lay the path. (`extra.palette.releaseToLay`)

{n} belts, {cost} coins (`extra.palette.beltsCount`)

1 belt, {cost} coins (`extra.palette.beltCount`)

Remove {name} (`extra.palette.removeWhat`). You get {coins} coins back. (`extra.palette.refundLine`)

The {name} stays in the garden. (`extra.palette.staysInYard` and `extra.errors.notRemovable`)

Place {item} (`extra.palette.placeItem`). Needs an empty belt. (`extra.palette.needsBelt`). Click to drop it on this belt. (`extra.palette.dropHere`)

After the Open Plot cost line: Opens more of the garden, about 90 tiles. You can't undo this. (`extra.palette.expandLine`)

### Blocked

When the next belt points back at this one: The belt ahead points back at this one, so turn one of them. (`extra.blocked.headOn`)

Blocked: enough of those (`extra.blocked.stockFull`)

The Packing Station is full of {item}. More can come in when an order needs them. (`extra.blocked.stockFullDetail`)

### Status lines

Moves one tile every {seconds} seconds. (`extra.states.movesEvery`)

One {item} every {seconds} seconds. (`extra.states.growsEvery`)

Output faces {facing}. (`extra.states.outputLeaves`)

Takes ingredients from any side, and the output faces {facing}. (`extra.states.takesAnySide`)

Received {count} (`extra.states.received`). {n} ready (`extra.states.readyCount`).

With the orders done, goods sell for coins as they arrive. (`extra.states.packingSandbox`)

Holds up to {cap} of each kind. (`extra.states.packingCap`)

Won't take {item}. This recipe doesn't use it, or that slot is full. (`extra.states.refused`)

### Inspector

{line} in {seconds} seconds (`extra.inspector.recipeSeconds`)

Holding (`extra.inspector.holding`)

Rotate, or press R. (`extra.inspector.rotateTip`)

Remove for a refund, or press Delete. (`extra.inspector.removeTip`)

### Celebration and ending

Open Plot (`extra.celebration.expansionName`)

{name} is in the build menu now. (`extra.celebration.unlockGeneric`)

Stat labels: Orders packed (`extra.ending.ordersFilled`), Items delivered (`extra.ending.itemsDelivered`), Coins earned (`extra.ending.coinsEarned`).

### How to play

How to Play (`extra.tutorial.helpTitle`)

Drag empty grass, or hold the middle mouse button, to pan. Scroll to zoom. Click a bed, belt, or machine to see details. (`extra.tutorial.mouse`)

### Errors

The Packing Station takes deliveries from every side, so there is nothing to turn. (`extra.errors.packingNoFacing`)

That tile is taken now, so nothing changed. (`extra.errors.undoTaken`)

Not enough coins to put that back. (`extra.errors.undoFunds`)

The basket has none of those. (`extra.errors.basketEmpty`)

The far plot is already open. (`extra.errors.expansionDone`)

More garden opens later. (`extra.errors.expansionLocked`)

### Extra control rows

Shown under the controls table. Input, then action.

| Input | Action |
| --- | --- |
| Arrows or WASD | Move the cursor |
| Enter or Space | Place or select at the cursor |
| Shift+R | Rotate the other way |
| X | Remove tool |
| Delete | Remove the selected structure |
| B | Show or hide the build menu |
| P | Pause or resume |
| F | Change speed |
| = and - | Zoom in or out |
| Home | Fit the garden |
| H | Open How to Play |
| M | Sound on or off |

### Sound controls (added Nov 2)

Top-bar speaker button, next to the speed buttons. Its screen-reader label: Sound on. Press to mute the music and effects. (`extra.sound.a11yOn`) / Sound off. Press to hear the music and effects again. (`extra.sound.a11yOff`). Hidden text: Sound on (`extra.sound.on`) / Sound off (`extra.sound.off`). Tooltip: Sound on or off (M) (`extra.sound.tooltip`).

Settings sliders: Music volume (`extra.sound.musicVolume`). How loud the tune plays. (`extra.sound.musicVolumeHelp`) Sound effects volume (`extra.sound.sfxVolume`). Let go of the slider to hear a sample. (`extra.sound.sfxVolumeHelp`)
