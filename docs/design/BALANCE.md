# Petalworks balance

Recommended first-pass numbers for coins, build costs, refunds, order rewards, and the garden expansion. Production times are the brief's. The session lands between 15 and 30 minutes because a first-time player is learning the garden, not because flowers are slow.

Reproduce every table and check with:

```bash
python3 tools/balance/simulate.py
```

The script exits 0 only when the careful and wasteful sessions both finish all 6 orders inside that window, the opening wallet can build a Daisy Bundle chain, and the wasteful player still has coin headroom. If a number below changes, change it in `tools/balance/simulate.py` and re-run.

## Recommended values

Starting coins: **120**.

| id | Name | Cost | Refund | Available when this order starts |
| --- | --- | ---: | ---: | --- |
| `daisy_bed` | Daisy Bed | 20 | 15 | 1 |
| `belt` | Conveyor Belt | 2 | 2 | 1 |
| `bundling_table` | Bundling Table | 40 | 30 | 1 |
| `lavender_bed` | Lavender Bed | 40 | 30 | 4 |
| `drying_bench` | Drying Bench | 60 | 45 | 5 |
| `arrangement_table` | Arrangement Table | 80 | 60 | 6 |
| `packing_station` | Packing Station | 0 | 0 | Pre-placed. Cannot be sold. |
| `expansion` | Garden expansion to 20×14 | 100 | 0 | 4. Optional. Permanent. |

| Order | Request | Reward | New build options |
| ---: | --- | ---: | --- |
| 1 | 2 daisies | 50 | Daisy Bed, Conveyor Belt, Bundling Table, Packing Station |
| 2 | 2 Daisy Bundles | 70 | — |
| 3 | 4 Daisy Bundles | 100 | — |
| 4 | 2 lavender | 80 | Lavender Bed, garden expansion |
| 5 | 2 Lavender Sachets | 110 | Drying Bench |
| 6 | 1 Mixed Bouquet | 140 | Arrangement Table |

| Process | Seconds |
| --- | ---: |
| Daisy Bed cycle | 4 |
| Lavender Bed cycle | 6 |
| Bundling Table, 2 daisies | 5 |
| Drying Bench, 2 lavender | 7 |
| Arrangement Table, 1 bundle + 1 sachet | 8 |
| Conveyor belt, per tile | 0.5 |
| Input buffer, per ingredient | 8 |

```ts
/** Copy into the sim data file when the game wires balance. */
export const BALANCE = {
  startCoins: 120,
  beltSecondsPerTile: 0.5,
  inputBufferPerIngredient: 8,
  buildingRefundNumerator: 3,
  buildingRefundDenominator: 4,
  costs: {
    daisy_bed: 20,
    lavender_bed: 40,
    belt: 2,
    bundling_table: 40,
    drying_bench: 60,
    arrangement_table: 80,
    packing_station: 0,
    expansion: 100,
  },
  orders: [
    { item: "daisy", count: 2, reward: 50 },
    { item: "daisy_bundle", count: 2, reward: 70 },
    { item: "daisy_bundle", count: 4, reward: 100 },
    { item: "lavender", count: 2, reward: 80 },
    { item: "lavender_sachet", count: 2, reward: 110 },
    { item: "mixed_bouquet", count: 1, reward: 140 },
  ],
  growSeconds: { daisy_bed: 4, lavender_bed: 6 },
  craftSeconds: { bundling_table: 5, drying_bench: 7, arrangement_table: 8 },
} as const;
```

Belt refund is the full 2 coins, not three-quarters. Building refund is `cost * 3 // 4`. Packing and the expansion refund 0.

## Rules that keep the numbers honest

**Packing Station** is already in the yard. It accepts from any side, costs nothing, and cannot be picked up. Every order needs it, so it is not something the player can sell into a dead end.

**Belts refund 100%.** Routing is the puzzle. A wrong turn should cost time, not the next machine. The price of 2 is enough that a huge scenic line ties coins up while it sits on the ground, and small enough that the player can lift it and try again.

**Beds and machines refund 75%, rounded down.** Picking up a Daisy Bed returns 15 of 20. A misplaced Arrangement Table returns 60 of 80. Mistakes sting a little and stay recoverable.

**The expansion is permanent.** It opens the garden from 16×12 (192 tiles) to 20×14 (280 tiles), 88 new tiles for 100 coins. It is a treat, not a tool the orders require.

**No upkeep and no fuel.**

**Deletion is blocked while a structure holds an item.** The player waits for a belt to clear, then picks it up. The model charges one traversal of the longest belt being removed and delivers those items to that belt's current destination. Items are not deleted and not duplicated.

**The completion toast pauses the factory.** Growth, crafting, and belts freeze until the next order starts, so a slow reader does not pre-finish the next delivery. Items already on belts stay put and count toward the next order when they match. Anything delivered beyond the quota sits in packing storage.

**Show the Bundling Table from the first moment.** Starting coins cover a working bundle chain before any order pays, which is only true if the table can actually be bought. Hiding it until order 2 is also solvent with these rewards (the careful player still has 142 coins when they buy it). The copy table above shows it at order 1 so the chain is buildable immediately.

## Why these numbers

A comfortable Daisy Bundle chain is one Daisy Bed (20), one Bundling Table (40), six belts (12), and the free packing crate: **72 coins**. Six belts is a short path with a turn in it. A perfectly straight path is two belts and costs 64. The player starts with **120**, so the chain is on the board with **48 coins left**.

That 48 is the opening cushion. Selling the bed and the table returns 45, and the belts return all 12, so each full teardown loses 15 coins. From 120, before order 1 pays anything, the player can construct that chain four times, selling it between attempts. After the fourth sale they hold 60, which is short of a fifth build. If they keep the fourth chain on the ground they have the line and 3 coins. A 75% building refund is what makes four constructions possible. At 50% the same exercise stops after two, and the wasteful session below can no longer afford to replace the Arrangement Table.

Order rewards are the generous part. They pay more than the machine the player is about to learn, and the bouquet pays the most:

| Delivery | Reward | The new machine, if any | Reward compared with that machine |
| --- | ---: | --- | --- |
| 2 daisies | 50 | — | A warm first payment, more than two Daisy Beds |
| 2 bundles | 70 | Bundling Table is 40 | Almost two tables |
| 4 bundles | 100 | — | The big daisy payout, and the expansion fund |
| 2 lavender | 80 | Lavender Bed is 40 | Two beds. Smaller than order 3 because the delivery is raw flowers, not four crafted bundles |
| 2 sachets | 110 | Drying Bench is 60 | The bench, plus 50 coins |
| 1 bouquet | 140 | Arrangement Table is 80 | The table, plus 60 coins to keep playing |

A careful player spends 28, 40, 26, 48, 60, and 84 across the six orders and finishes with **384** coins, up from 120. That leftover is the sandbox: the expansion (100), another Arrangement Table (80), and more beds, without another order to grind.

Prices stay in tens so the shop is readable. Belts are the odd 2 on purpose, so a long route is a handful of coins rather than a budget.

Flower times stay at 4, 6, 5, 7, and 8 seconds. Stretching them to fill a half hour would make the garden feel like a timer. The belt step is **0.5 seconds per tile**: a flower is easy to follow, and a four-tile run is two seconds. Switching the model to 1.0 seconds per tile adds 11 seconds to the careful session. Belt speed is the wrong knob for session length.

## How long the first session is

The factory side is simulated tick by tick (0.5 second belt steps, growth and crafts on that same clock). The hands-on side is a script of a first-time player at 1× speed: reading the order, placing, rotating, and, for the bouquet, fixing a belt that faced the wrong way. Those hands-on seconds are estimates for someone meeting the garden for the first time, not a playtest. They live in `careful_script` and `wasteful_script` inside the simulator so they can be revised and re-measured.

Cold clock, line already built, nothing in storage, one of each machine unless noted:

| Situation | Time |
| --- | ---: |
| Order 1, daisy, 4-tile belt | 0:10 |
| Order 2, one bed, two bundles | 0:23 |
| Order 3, one bed, four bundles | 0:39 |
| Order 3, two beds | 0:26 |
| Order 4, lavender, 3-tile belt | 0:14 |
| Order 5, two sachets | 0:33 |
| Order 6, one bouquet, one or two daisy beds | 0:30 |
| Sum of the one-bed orders | 2:28 |

Two daisy beds shorten order 3 from 39 seconds to 26.5 seconds. The bundler takes 5 seconds, so the second bed helps and then the table is the limit. Order 6 stays 30 seconds either way: one sachet is the slow ingredient, not the daisies. A player who never builds a second bed still finishes, and the frugal run below does exactly that.

In the full session the cold waits mostly disappear. The player is still placing when the quota is met, the toast pauses the line, and the "watching" column stays at zero except for an 8 second beat on the frugal order 3. That is the cozy shape we want: the garden keeps up with a new player instead of parking them.

Hands-on time assumed for the careful player, excluding any idle watching:

| Order | Hands-on | What they are doing |
| ---: | ---: | --- |
| 1 | 4:46 | Tutorial, camera, palette, first bed, short belt, celebration |
| 2 | 2:40 | First table, including turning the output toward packing |
| 3 | 1:18 | A second Daisy Bed on the existing line |
| 4 | 1:36 | Lavender Bed and a belt to the crate |
| 5 | 2:12 | Drying Bench, including a look at its output |
| 6 | 5:15 | Planning the merge, one backwards belt, finale, sandbox handoff |
| Total | 17:47 | |

### Careful player

No refunds, no expansion, short belts, and a second Daisy Bed because order 3 is the throughput lesson. Session **17:47**. Lowest wallet **92**. Ends at **384** coins on 20 tiles (13 of them belts).

| Order | Request | Clock | This order | Spent | Refunded | Reward | Wallet | Low point |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 daisies | 4:46 | 4:46 | 28 | 0 | 50 | 142 | 92 |
| 2 | 2 Daisy Bundles | 7:26 | 2:40 | 40 | 0 | 70 | 172 | 102 |
| 3 | 4 Daisy Bundles | 8:44 | 1:18 | 26 | 0 | 100 | 246 | 152 |
| 4 | 2 lavender | 10:20 | 1:36 | 48 | 0 | 80 | 278 | 198 |
| 5 | 2 Lavender Sachets | 12:32 | 2:12 | 60 | 0 | 110 | 328 | 218 |
| 6 | 1 Mixed Bouquet | 17:17 | 4:45 | 84 | 0 | 140 | 384 | 244 |

The clock on order 6 is the end of the finale toast. The last 30 seconds are the completion moment, which brings the session to 17:47. Wallet after each toast climbs the whole way.

Teaching layout at the end of order 6:

```text
[Daisy] → → [Bundle] → → [Arrange] → → [Pack]
[Daisy] → → → [Bundle]
[Lavender] → → [Dry] → → [Arrange]
```

### Wasteful player

This is the "wastes some coins" case the prices have to survive:

- Misplaces every new bed and machine once, picks it up at 75%, and places it again.
- Lays about twice the belt and keeps it.
- Buys the expansion the moment order 4 unlocks it, before the Lavender Bed.
- Keeps a second Daisy Bed.

Session **24:00**. Lowest wallet **46**, which is the moment after the expansion, the replaced lavender bed, and the long belt, just before order 4 pays. Ends at **193** coins on 33 tiles. The 16×12 garden holds that without the expansion; they bought the expansion anyway.

| Order | Request | Clock | This order | Spent | Refunded | Reward | Wallet | Low point |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 daisies | 6:04 | 6:04 | 56 | 15 | 50 | 129 | 79 |
| 2 | 2 Daisy Bundles | 9:01 | 2:57 | 80 | 30 | 70 | 149 | 79 |
| 3 | 4 Daisy Bundles | 11:15 | 2:14 | 52 | 15 | 100 | 212 | 129 |
| 4 | 2 lavender | 14:35 | 3:20 | 196 | 30 | 80 | 126 | 46 |
| 5 | 2 Lavender Sachets | 17:07 | 2:32 | 120 | 45 | 110 | 161 | 51 |
| 6 | 1 Mixed Bouquet | 23:30 | 6:23 | 168 | 60 | 140 | 193 | 53 |

Spent is the gross outlay. Refunded is what came back the same order. Wallet is after the reward. The dip from 212 to 126 is the expansion. The finale puts them back near 200, so the sandbox still feels open.

### Other clocks

| Player | Session | Ends with | Notes |
| --- | ---: | ---: | --- |
| Frugal | 17:11 | 410 | One Daisy Bed, no expansion. Order 3 takes 44 seconds plus 8 seconds of watching. |
| Eager | 14:10 | 384 | Builds the bundle chain before delivering a daisy, then rewires around the table. Under the 15 minute floor because they skip part of the careful hesitation. Lowest wallet 52. |
| Fluent | 8:15 | 384 | Same layout as careful, hands-on actions at 0.45×. A returning player. Factory time is not scaled. |

The fluent clock is the argument against longer grow times. Someone who already knows the garden should be allowed to finish. The 15 to 30 minute target is the first visit.

## Softlock analysis

A softlock here means the next required building or belt cannot be paid for, and selling what they already own at the refund rules still would not be assumed. The scripted players do not liquidate their garden to survive. They just keep going, and the wallet stays positive.

**Opening chain.** 120 ≥ 72. The player can place bed, table, and six belts before order 1, with 48 coins in hand. Four full sell-and-rebuild cycles fit in that wallet. The fifth does not. That bound is the "I changed my mind about the whole starter line" case, and it is covered.

**The bundler can eat the daisy order.** If the only path is bed → table → crate, raw daisies become bundles and order 1 never sees them. The eager player does this, notices a bundle in the crate, and points the bed straight at packing. The rewire is free at a 100% belt refund. Their wallet bottoms at 52 and they still clear every later order. The game should keep that rewire legal: one output per bed, belts fully refunded, and a bed that can be turned toward the crate without selling the table.

**Order 3 does not require a second bed.** The frugal player leaves the single daisy line alone and finishes. The second bed is a visible speedup (39s → 26.5s) and a good tutorial hint. It is not a coin gate and not a time gate.

**The expansion is not a space gate.** The careful finale uses 20 tiles. The wasteful finale uses 33, including the long belts. Both fit in 192. A player who never spends the 100 coins is fine. A player who spends them at the first opportunity is also fine: after that purchase the wasteful wallet's low point is 46, which is still enough to finish the lavender bed they just unlocked.

**Headroom on top of the wasteful script: 46 coins.** Those 46 can be thrown away at the very start, with no refund, and the wasteful player still clears. The 47th coin is the edge. That is the unrecoverable waste budget once every scripted mistake and the expansion are already paid.

**A spare Drying Bench is the next edge.** Buying a second bench and leaving it unconnected, on top of the wasteful script, leaves the player 7 coins short of the last four belts (1 coin in hand, 8 needed). Selling that spare bench returns 45 and the belts fit again. The dead end only sticks if they refuse to pick the spare up. One bench is enough for order 5 and order 6.

**A 50% building refund does not survive the wasteful script.** Replacing the Arrangement Table costs 80, and that player has 76 after the rest of their mistakes. Order 4 also dips to 16 coins before its reward, and the dryer rebuild later dips to 6. Three-quarters is the policy that keeps the same behavior solvent. It is also the policy that allows four starter-chain rebuilds instead of two.

**What would actually trap a player, so the game should not allow it:**

- Selling or deleting the Packing Station.
- Destroying items when a belt or machine is removed, in a way that also burns their coin value. Block the removal until the tile is empty.
- Charging a partial refund on belts. A player who paved a long wrong route would then have to choose between the route and the next machine.
- Unlocking the Lavender Bed, Drying Bench, or Arrangement Table only after the order that needs it is already turned in.
- Requiring the expansion, or a second copy of any machine, to finish the six orders.

## Assumptions the sim is making for the rest of the game

- One active order. Packing counts an item toward it only when the kind matches and the quota is still open.
- Machines accept a legal ingredient from any adjacent input belt and output only on their facing side. Beds have one output.
- An input buffer holds 8 of each ingredient. These orders never fill it. The cap is there so a blocked crate cannot swallow an infinite pile.
- A bed grows while its output is free, then holds one flower in the ready state until the belt takes it. The grow timer starts over when the flower leaves.
- A machine crafts only when every ingredient is buffered, it is not already crafting, and its output slot is empty.
- Celebration pauses the sim. Sandbox play after order 6 keeps the garden, the coins, and every unlocked building.
