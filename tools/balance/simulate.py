#!/usr/bin/env python3
"""Petalworks first-pass balance model.

Run from the repo root:

    python3 tools/balance/simulate.py

The script simulates coins, refunds, unlocks, and a small factory
(grow times, craft times, belt travel) for a careful first-time player
and a wasteful one. It exits 0 when the recommended numbers meet the
session-length and no-softlock checks, and prints the tables copied
into docs/design/BALANCE.md.

No third-party packages. Production times default to the brief.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass, field, replace


TICK_EPSILON = 1e-9


# ---------------------------------------------------------------------------
# Recommended numbers. These are the values BALANCE.md tells the game to use.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Config:
    start_coins: int = 120
    daisy_bed: int = 20
    lavender_bed: int = 40
    belt: int = 2
    bundling_table: int = 40
    drying_bench: int = 60
    arrangement_table: int = 80
    packing_station: int = 0
    expansion: int = 100
    # Building refund is numerator/denominator, rounded down.
    # Belts refund in full so a routing mistake cannot softlock the player.
    building_refund_num: int = 3
    building_refund_den: int = 4
    # Brief times, in seconds. Not lore; the model keeps them as written.
    daisy_seconds: float = 4.0
    lavender_seconds: float = 6.0
    bundle_seconds: float = 5.0
    sachet_seconds: float = 7.0
    bouquet_seconds: float = 8.0
    belt_seconds: float = 0.5
    input_buffer: int = 8
    rewards: tuple[int, ...] = (0, 50, 70, 100, 80, 110, 140)
    # Player-action durations are multiplied by this. Factory time is not.
    pace: float = 1.0

    def cost(self, kind: str) -> int:
        return getattr(self, kind)

    def building_refund(self, kind: str) -> int:
        if kind == "belt":
            return self.belt
        if kind in ("packing_station", "expansion"):
            return 0
        return self.cost(kind) * self.building_refund_num // self.building_refund_den

    def grow_seconds(self, kind: str) -> float:
        if kind == "daisy_bed":
            return self.daisy_seconds
        if kind == "lavender_bed":
            return self.lavender_seconds
        raise KeyError(kind)

    def recipe(self, kind: str) -> Recipe | None:
        if kind == "bundling_table":
            return Recipe((("daisy", 2),), "daisy_bundle", self.bundle_seconds)
        if kind == "drying_bench":
            return Recipe((("lavender", 2),), "lavender_sachet", self.sachet_seconds)
        if kind == "arrangement_table":
            return Recipe(
                (("daisy_bundle", 1), ("lavender_sachet", 1)),
                "mixed_bouquet",
                self.bouquet_seconds,
            )
        return None


@dataclass(frozen=True)
class Recipe:
    inputs: tuple[tuple[str, int], ...]
    output: str
    seconds: float


ORDERS: tuple[tuple[str, int], ...] = (
    ("", 0),
    ("daisy", 2),
    ("daisy_bundle", 2),
    ("daisy_bundle", 4),
    ("lavender", 2),
    ("lavender_sachet", 2),
    ("mixed_bouquet", 1),
)

ORDER_LABELS = (
    "",
    "2 daisies",
    "2 daisy bundles",
    "4 daisy bundles",
    "2 lavender",
    "2 lavender sachets",
    "1 mixed bouquet",
)

# Buildings granted the moment that order becomes active.
UNLOCKS_AT_ORDER_START: dict[int, tuple[str, ...]] = {
    1: ("daisy_bed", "belt", "bundling_table", "packing_station"),
    4: ("lavender_bed", "expansion"),
    # Trailing commas are required. Without them these are strings, and the
    # unlock loop would grant one letter at a time.
    5: ("drying_bench",),
    6: ("arrangement_table",),
}

BEDS = frozenset({"daisy_bed", "lavender_bed"})
MACHINES = frozenset({"bundling_table", "drying_bench", "arrangement_table"})

# Comfortable starter chain: bed, bundler, six belts, packing already in the yard.
# Six belts is a short path with one turn, not the mathematical minimum of two.
COMFORTABLE_BELT_COUNT = 6
MIN_BELT_COUNT = 2


def comfortable_chain_cost(cfg: Config) -> int:
    return cfg.daisy_bed + cfg.bundling_table + COMFORTABLE_BELT_COUNT * cfg.belt


def minimum_chain_cost(cfg: Config) -> int:
    return cfg.daisy_bed + cfg.bundling_table + MIN_BELT_COUNT * cfg.belt


# ---------------------------------------------------------------------------
# Layouts. Belt length is the number of tiles between source and destination.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Layout:
    entities: tuple[tuple[str, str], ...]
    links: tuple[tuple[str, str, int], ...]

    @property
    def belt_tiles(self) -> int:
        return sum(length for _, _, length in self.links)


def L(
    entities: tuple[tuple[str, str], ...],
    links: tuple[tuple[str, str, int], ...],
) -> Layout:
    ents = (("pack", "packing_station"),) + tuple(
        e for e in entities if e[0] != "pack"
    )
    return Layout(ents, links)


LAYOUTS: dict[str, Layout] = {
    # Careful / frugal paths. Short, direct, one turn at most.
    "c1": L((("bed1", "daisy_bed"),), (("bed1", "pack", 4),)),
    "c2": L(
        (("bed1", "daisy_bed"), ("bundler", "bundling_table")),
        (("bed1", "bundler", 2), ("bundler", "pack", 2)),
    ),
    "c3": L(
        (
            ("bed1", "daisy_bed"),
            ("bed2", "daisy_bed"),
            ("bundler", "bundling_table"),
        ),
        (
            ("bed1", "bundler", 2),
            ("bed2", "bundler", 3),
            ("bundler", "pack", 2),
        ),
    ),
    "c4": L(
        (
            ("bed1", "daisy_bed"),
            ("bed2", "daisy_bed"),
            ("bundler", "bundling_table"),
            ("lav1", "lavender_bed"),
        ),
        (
            ("bed1", "bundler", 2),
            ("bed2", "bundler", 3),
            ("bundler", "pack", 2),
            ("lav1", "pack", 4),
        ),
    ),
    "c5": L(
        (
            ("bed1", "daisy_bed"),
            ("bed2", "daisy_bed"),
            ("bundler", "bundling_table"),
            ("lav1", "lavender_bed"),
            ("dryer", "drying_bench"),
        ),
        (
            ("bed1", "bundler", 2),
            ("bed2", "bundler", 3),
            ("bundler", "pack", 2),
            ("lav1", "dryer", 2),
            ("dryer", "pack", 2),
        ),
    ),
    "c6": L(
        (
            ("bed1", "daisy_bed"),
            ("bed2", "daisy_bed"),
            ("bundler", "bundling_table"),
            ("lav1", "lavender_bed"),
            ("dryer", "drying_bench"),
            ("arrange", "arrangement_table"),
        ),
        (
            ("bed1", "bundler", 2),
            ("bed2", "bundler", 3),
            ("lav1", "dryer", 2),
            ("bundler", "arrange", 2),
            ("dryer", "arrange", 2),
            ("arrange", "pack", 2),
        ),
    ),
    # One daisy bed only. Proves order 3 does not require a second bed.
    "f3": L(
        (("bed1", "daisy_bed"), ("bundler", "bundling_table")),
        (("bed1", "bundler", 2), ("bundler", "pack", 2)),
    ),
    "f4": L(
        (
            ("bed1", "daisy_bed"),
            ("bundler", "bundling_table"),
            ("lav1", "lavender_bed"),
        ),
        (
            ("bed1", "bundler", 2),
            ("bundler", "pack", 2),
            ("lav1", "pack", 3),
        ),
    ),
    "f5": L(
        (
            ("bed1", "daisy_bed"),
            ("bundler", "bundling_table"),
            ("lav1", "lavender_bed"),
            ("dryer", "drying_bench"),
        ),
        (
            ("bed1", "bundler", 2),
            ("bundler", "pack", 2),
            ("lav1", "dryer", 2),
            ("dryer", "pack", 2),
        ),
    ),
    "f6": L(
        (
            ("bed1", "daisy_bed"),
            ("bundler", "bundling_table"),
            ("lav1", "lavender_bed"),
            ("dryer", "drying_bench"),
            ("arrange", "arrangement_table"),
        ),
        (
            ("bed1", "bundler", 2),
            ("lav1", "dryer", 2),
            ("bundler", "arrange", 2),
            ("dryer", "arrange", 2),
            ("arrange", "pack", 2),
        ),
    ),
    # Wasteful paths: about twice the belt, still a valid chain.
    "w1": L((("bed1", "daisy_bed"),), (("bed1", "pack", 8),)),
    "w2": L(
        (("bed1", "daisy_bed"), ("bundler", "bundling_table")),
        (("bed1", "bundler", 4), ("bundler", "pack", 4)),
    ),
    "w3": L(
        (
            ("bed1", "daisy_bed"),
            ("bed2", "daisy_bed"),
            ("bundler", "bundling_table"),
        ),
        (
            ("bed1", "bundler", 4),
            ("bed2", "bundler", 6),
            ("bundler", "pack", 4),
        ),
    ),
    "w4": L(
        (
            ("bed1", "daisy_bed"),
            ("bed2", "daisy_bed"),
            ("bundler", "bundling_table"),
            ("lav1", "lavender_bed"),
        ),
        (
            ("bed1", "bundler", 4),
            ("bed2", "bundler", 6),
            ("bundler", "pack", 4),
            ("lav1", "pack", 8),
        ),
    ),
    "w5": L(
        (
            ("bed1", "daisy_bed"),
            ("bed2", "daisy_bed"),
            ("bundler", "bundling_table"),
            ("lav1", "lavender_bed"),
            ("dryer", "drying_bench"),
        ),
        (
            ("bed1", "bundler", 4),
            ("bed2", "bundler", 6),
            ("bundler", "pack", 4),
            ("lav1", "dryer", 4),
            ("dryer", "pack", 4),
        ),
    ),
    "w6": L(
        (
            ("bed1", "daisy_bed"),
            ("bed2", "daisy_bed"),
            ("bundler", "bundling_table"),
            ("lav1", "lavender_bed"),
            ("dryer", "drying_bench"),
            ("arrange", "arrangement_table"),
        ),
        (
            ("bed1", "bundler", 4),
            ("bed2", "bundler", 6),
            ("lav1", "dryer", 4),
            ("bundler", "arrange", 4),
            ("dryer", "arrange", 4),
            ("arrange", "pack", 4),
        ),
    ),
    # Eager player built the bundler into the only daisy path, then rewires
    # a bypass so raw daisies can reach packing without being crafted.
    "eager_chain": L(
        (("bed1", "daisy_bed"), ("bundler", "bundling_table")),
        (("bed1", "bundler", 2), ("bundler", "pack", 2)),
    ),
    "eager_bypass": L(
        (("bed1", "daisy_bed"), ("bundler", "bundling_table")),
        (("bed1", "pack", 3),),
    ),
}


# ---------------------------------------------------------------------------
# Player scripts.
# kind: think | buy | sell | layout | wait | celebrate | expansion | ending
# `order` attributes hands-on time. Factory waiting is measured, not scripted.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Act:
    kind: str
    seconds: float = 0.0
    order: int = 1
    label: str = ""
    item: str | None = None
    eid: str | None = None
    layout: str | None = None


def careful_script() -> list[Act]:
    """Attentive first session. Builds the teaching layout, no refunds, no expansion."""
    return [
        Act("think", 180, 1, "Tutorial, camera, and palette tour"),
        Act("think", 30, 1, "Read the daisy order"),
        Act("buy", 24, 1, "Place the first Daisy Bed", "daisy_bed", "bed1"),
        Act("layout", 40, 1, "Drag a short belt to the packing crate", layout="c1"),
        Act("wait", 0, 1, "Watch daisies arrive"),
        Act("celebrate", 12, 1, "Order celebration"),
        Act("think", 36, 2, "Read the bundle order and the new table"),
        Act("buy", 28, 2, "Place the Bundling Table", "bundling_table", "bundler"),
        Act("layout", 60, 2, "Insert the table into the line", layout="c2"),
        Act("think", 24, 2, "Rotate the table so the tray faces packing"),
        Act("wait", 0, 2, "Watch bundles"),
        Act("celebrate", 12, 2, "Order celebration"),
        Act("think", 20, 3, "Read the bigger bundle order"),
        Act("buy", 18, 3, "Place a second Daisy Bed", "daisy_bed", "bed2"),
        Act("layout", 28, 3, "Connect the second bed", layout="c3"),
        Act("wait", 0, 3, "Watch the doubled line"),
        Act("celebrate", 12, 3, "Order celebration"),
        Act("think", 28, 4, "Read the lavender order"),
        Act("buy", 24, 4, "Place a Lavender Bed", "lavender_bed", "lav1"),
        Act("layout", 32, 4, "Belt lavender to packing", layout="c4"),
        Act("wait", 0, 4, "Watch lavender"),
        Act("celebrate", 12, 4, "Order celebration"),
        Act("think", 30, 5, "Read the sachet order"),
        Act("buy", 26, 5, "Place the Drying Bench", "drying_bench", "dryer"),
        Act("think", 30, 5, "Check the bench output faces the belt"),
        Act("layout", 34, 5, "Insert the bench into the lavender line", layout="c5"),
        Act("wait", 0, 5, "Watch sachets"),
        Act("celebrate", 12, 5, "Order celebration"),
        Act("think", 48, 6, "Read the bouquet order"),
        Act("think", 90, 6, "Plan how two lines can meet"),
        Act("buy", 30, 6, "Place the Arrangement Table", "arrangement_table", "arrange"),
        Act("layout", 44, 6, "Merge both lines into the table", layout="c6"),
        Act("think", 55, 6, "Fix a belt that faced the wrong way"),
        Act("wait", 0, 6, "Watch the bouquet"),
        Act("celebrate", 18, 6, "Finale celebration"),
        Act("ending", 30, 6, "Completion moment and sandbox handoff"),
    ]


def wasteful_script() -> list[Act]:
    """First session that misplaces every new building once, lays long belts,
    buys the expansion the moment it unlocks (before the lavender bed),
    and keeps a second daisy bed. Belts are kept, not spam-deleted.
    """
    return [
        Act("think", 180, 1, "Tutorial, plus getting lost in the palette"),
        Act("think", 40, 1, "Read the daisy order"),
        Act("buy", 24, 1, "Place a Daisy Bed facing the hedge", "daisy_bed", "bed1"),
        Act("sell", 14, 1, "Pick the bed back up", eid="bed1"),
        Act("buy", 22, 1, "Place the Daisy Bed again", "daisy_bed", "bed1"),
        Act("layout", 70, 1, "Drag a long scenic belt to packing", layout="w1"),
        Act("wait", 0, 1, "Watch daisies arrive"),
        Act("celebrate", 14, 1, "Order celebration"),
        Act("think", 40, 2, "Read the bundle order"),
        Act("buy", 26, 2, "Place the Bundling Table on the wrong side", "bundling_table", "bundler"),
        Act("sell", 14, 2, "Pick the table back up", eid="bundler"),
        Act("buy", 24, 2, "Place the Bundling Table again", "bundling_table", "bundler"),
        Act("layout", 55, 2, "Rebuild a long line through the table", layout="w2"),
        Act("wait", 0, 2, "Watch bundles"),
        Act("celebrate", 14, 2, "Order celebration"),
        Act("think", 30, 3, "Read the bigger bundle order"),
        Act("buy", 20, 3, "Place a second Daisy Bed in a corner", "daisy_bed", "bed2"),
        Act("sell", 12, 3, "Pick that bed back up", eid="bed2"),
        Act("buy", 18, 3, "Place the second bed where the belt can reach", "daisy_bed", "bed2"),
        Act("layout", 40, 3, "Connect it with a wandering belt", layout="w3"),
        Act("wait", 0, 3, "Watch the line"),
        Act("celebrate", 14, 3, "Order celebration"),
        Act("think", 20, 4, "Admire the unlocked garden plot"),
        Act("expansion", 40, 4, "Buy the 20×14 expansion immediately"),
        Act("think", 24, 4, "Read the lavender order"),
        Act("buy", 22, 4, "Place a Lavender Bed backwards", "lavender_bed", "lav1"),
        Act("sell", 12, 4, "Pick the bed back up", eid="lav1"),
        Act("buy", 20, 4, "Place the Lavender Bed again", "lavender_bed", "lav1"),
        Act("layout", 48, 4, "Belt lavender the long way to packing", layout="w4"),
        Act("wait", 0, 4, "Watch lavender"),
        Act("celebrate", 14, 4, "Order celebration"),
        Act("think", 28, 5, "Read the sachet order"),
        Act("buy", 24, 5, "Place the Drying Bench in the aisle", "drying_bench", "dryer"),
        Act("sell", 12, 5, "Pick the bench back up", eid="dryer"),
        Act("buy", 22, 5, "Place the Drying Bench again", "drying_bench", "dryer"),
        Act("layout", 48, 5, "Insert the bench into the long lavender line", layout="w5"),
        Act("wait", 0, 5, "Watch sachets"),
        Act("celebrate", 14, 5, "Order celebration"),
        Act("think", 55, 6, "Read the bouquet order"),
        Act("think", 90, 6, "Stare at two lines and undo a merge"),
        Act("buy", 28, 6, "Place the Arrangement Table backwards", "arrangement_table", "arrange"),
        Act("sell", 14, 6, "Pick the table back up", eid="arrange"),
        Act("buy", 26, 6, "Place the Arrangement Table again", "arrangement_table", "arrange"),
        Act("layout", 70, 6, "Merge both lines with long belts", layout="w6"),
        Act("think", 80, 6, "Fix two belts that faced the wrong way"),
        Act("wait", 0, 6, "Watch the bouquet"),
        Act("celebrate", 18, 6, "Finale celebration"),
        Act("ending", 30, 6, "Completion moment and sandbox handoff"),
    ]


def frugal_script() -> list[Act]:
    """Same care as the careful player, but one daisy bed and no expansion.
    Used to prove the second bed is a lesson, not a requirement.
    """
    return [
        Act("think", 180, 1, "Tutorial, camera, and palette tour"),
        Act("think", 30, 1, "Read the daisy order"),
        Act("buy", 24, 1, "Place the first Daisy Bed", "daisy_bed", "bed1"),
        Act("layout", 40, 1, "Drag a short belt to the packing crate", layout="c1"),
        Act("wait", 0, 1, "Watch daisies arrive"),
        Act("celebrate", 12, 1, "Order celebration"),
        Act("think", 36, 2, "Read the bundle order and the new table"),
        Act("buy", 28, 2, "Place the Bundling Table", "bundling_table", "bundler"),
        Act("layout", 60, 2, "Insert the table into the line", layout="c2"),
        Act("think", 24, 2, "Rotate the table so the tray faces packing"),
        Act("wait", 0, 2, "Watch bundles"),
        Act("celebrate", 12, 2, "Order celebration"),
        Act("think", 24, 3, "Read the bigger bundle order and leave the line alone"),
        Act("wait", 0, 3, "Watch four bundles from one bed"),
        Act("celebrate", 12, 3, "Order celebration"),
        Act("think", 28, 4, "Read the lavender order"),
        Act("buy", 24, 4, "Place a Lavender Bed", "lavender_bed", "lav1"),
        Act("layout", 30, 4, "Belt lavender to packing", layout="f4"),
        Act("wait", 0, 4, "Watch lavender"),
        Act("celebrate", 12, 4, "Order celebration"),
        Act("think", 30, 5, "Read the sachet order"),
        Act("buy", 26, 5, "Place the Drying Bench", "drying_bench", "dryer"),
        Act("think", 30, 5, "Check the bench output faces the belt"),
        Act("layout", 34, 5, "Insert the bench into the lavender line", layout="f5"),
        Act("wait", 0, 5, "Watch sachets"),
        Act("celebrate", 12, 5, "Order celebration"),
        Act("think", 48, 6, "Read the bouquet order"),
        Act("think", 90, 6, "Plan how two lines can meet"),
        Act("buy", 30, 6, "Place the Arrangement Table", "arrangement_table", "arrange"),
        Act("layout", 44, 6, "Merge both lines into the table", layout="f6"),
        Act("think", 55, 6, "Fix a belt that faced the wrong way"),
        Act("wait", 0, 6, "Watch the bouquet"),
        Act("celebrate", 18, 6, "Finale celebration"),
        Act("ending", 30, 6, "Completion moment and sandbox handoff"),
    ]


def eager_script() -> list[Act]:
    """Spends starting coins on the full bundle chain before delivering a daisy,
    then rewires a bypass so the bundler does not eat the raw order.
    """
    return [
        Act("think", 120, 1, "Tutorial, then decides to build the whole chain"),
        Act("think", 20, 1, "Read the daisy order and ignore it for a minute"),
        Act("buy", 24, 1, "Place a Daisy Bed", "daisy_bed", "bed1"),
        Act("buy", 28, 1, "Place a Bundling Table early", "bundling_table", "bundler"),
        Act("layout", 40, 1, "Wire bed through the table to packing", layout="eager_chain"),
        Act("think", 25, 1, "Wonder why packing received a bundle, not daisies"),
        Act("layout", 30, 1, "Rewire the bed straight to packing", layout="eager_bypass"),
        Act("wait", 0, 1, "Watch raw daisies"),
        Act("celebrate", 12, 1, "Order celebration"),
        Act("think", 20, 2, "Read the bundle order"),
        Act("layout", 28, 2, "Point the bed back through the table", layout="c2"),
        Act("wait", 0, 2, "Watch bundles"),
        Act("celebrate", 12, 2, "Order celebration"),
        Act("think", 20, 3, "Read the bigger bundle order"),
        Act("buy", 18, 3, "Place a second Daisy Bed", "daisy_bed", "bed2"),
        Act("layout", 28, 3, "Connect the second bed", layout="c3"),
        Act("wait", 0, 3, "Watch the doubled line"),
        Act("celebrate", 12, 3, "Order celebration"),
        Act("think", 28, 4, "Read the lavender order"),
        Act("buy", 24, 4, "Place a Lavender Bed", "lavender_bed", "lav1"),
        Act("layout", 32, 4, "Belt lavender to packing", layout="c4"),
        Act("wait", 0, 4, "Watch lavender"),
        Act("celebrate", 12, 4, "Order celebration"),
        Act("think", 30, 5, "Read the sachet order"),
        Act("buy", 26, 5, "Place the Drying Bench", "drying_bench", "dryer"),
        Act("layout", 34, 5, "Insert the bench into the lavender line", layout="c5"),
        Act("wait", 0, 5, "Watch sachets"),
        Act("celebrate", 12, 5, "Order celebration"),
        Act("think", 48, 6, "Read the bouquet order"),
        Act("think", 50, 6, "Plan the merge"),
        Act("buy", 30, 6, "Place the Arrangement Table", "arrangement_table", "arrange"),
        Act("layout", 44, 6, "Merge both lines into the table", layout="c6"),
        Act("wait", 0, 6, "Watch the bouquet"),
        Act("celebrate", 18, 6, "Finale celebration"),
        Act("ending", 25, 6, "Completion moment"),
    ]


def stress_script() -> list[Act]:
    """Wasteful path, plus an unconnected extra dryer bought before the bouquet.
    This is the edge of 'some waste', not the profile we promise will finish
    with a cushion. The report says whether it still clears.
    """
    acts = list(wasteful_script())
    # Insert the extra purchase just before order 6's reading, after order 5 celebration.
    extra = [
        Act("buy", 20, 6, "Impulsively place a second Drying Bench", "drying_bench", "dryer2"),
        Act("think", 15, 6, "Leave the spare bench unconnected"),
    ]
    for i, act in enumerate(acts):
        if act.order == 6 and act.kind == "think":
            return acts[:i] + extra + acts[i:]
    raise RuntimeError("could not splice stress script")


# ---------------------------------------------------------------------------
# Factory + wallet simulation
# ---------------------------------------------------------------------------


class SoftLock(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


@dataclass
class Runtime:
    kind: str
    timer: float = 0.0
    holding: str | None = None
    crafting: bool = False
    buffers: dict[str, int] = field(default_factory=dict)
    placed: bool = False


@dataclass
class Belt:
    source: str
    dest: str
    slots: list[str | None]


@dataclass
class OrderRow:
    order: int
    label: str
    start_t: float
    end_t: float
    hands_on: float
    watch: float
    drain: float
    spent: int
    refunded: int
    reward: int
    wallet: int
    wallet_min: int
    delivered_note: str


@dataclass
class RunResult:
    name: str
    ok: bool
    message: str
    total_t: float
    coins: int
    rows: list[OrderRow]
    tiles: int
    belts: int
    expansion: bool
    min_wallet: int
    hands_on: float
    watch: float
    ledger: list[str] = field(default_factory=list)


class Sim:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.t = 0.0
        self.coins = cfg.start_coins
        self.min_wallet = cfg.start_coins
        self.unlocks = set()
        self.owned: dict[str, str] = {}
        self.board: dict[str, Runtime] = {}
        self.belts: list[Belt] = []
        self.layout_name = ""
        self.order_index = 0
        self.delivered = 0
        self.order_done = False
        self.reward_paid = False
        self.stock: dict[str, int] = {}
        self.expansion = False
        self.rows: list[OrderRow] = []
        self.ledger: list[str] = []
        self.hands_on = 0.0
        self.watch = 0.0
        self.drain_time = 0.0
        self._seg_hands = 0.0
        self._seg_watch = 0.0
        self._seg_drain = 0.0
        self._seg_spent = 0
        self._seg_refunded = 0
        self._seg_min = cfg.start_coins
        self._seg_start = 0.0
        self.failed: str | None = None
        # Packing crate is already in the yard.
        self.owned["pack"] = "packing_station"
        self.board["pack"] = Runtime("packing_station", placed=True)

    # -- money ---------------------------------------------------------------

    def _touch_wallet(self) -> None:
        if self.coins < self.min_wallet:
            self.min_wallet = self.coins
        if self.coins < self._seg_min:
            self._seg_min = self.coins

    def _pay(self, amount: int, why: str) -> None:
        if amount > self.coins:
            raise SoftLock(
                f"short {amount - self.coins} coins for {why} "
                f"(have {self.coins}, need {amount}) at {fmt(self.t)} during order {self.order_index}"
            )
        self.coins -= amount
        self._seg_spent += amount
        self._touch_wallet()
        self.ledger.append(f"{fmt(self.t)}  -{amount:<4} {why}  wallet {self.coins}")

    def _gain(self, amount: int, why: str, refund: bool) -> None:
        self.coins += amount
        if refund:
            self._seg_refunded += amount
        self.ledger.append(f"{fmt(self.t)}  +{amount:<4} {why}  wallet {self.coins}")

    # -- orders --------------------------------------------------------------

    def start_order(self, index: int) -> None:
        self.order_index = index
        self.delivered = 0
        self.order_done = False
        self.reward_paid = False
        for kind in UNLOCKS_AT_ORDER_START.get(index, ()):
            self.unlocks.add(kind)
        item, count = ORDERS[index]
        carried = min(self.stock.get(item, 0), count)
        if carried:
            self.stock[item] -= carried
            self.delivered = carried
        self._seg_hands = 0.0
        self._seg_watch = 0.0
        self._seg_drain = 0.0
        self._seg_spent = 0
        self._seg_refunded = 0
        self._seg_min = self.coins
        self._seg_start = self.t
        if self.delivered >= count:
            self._complete()

    def _complete(self) -> None:
        if self.reward_paid:
            return
        self.reward_paid = True
        self.order_done = True
        reward = self.cfg.rewards[self.order_index]
        self._gain(reward, f"order {self.order_index} reward", refund=False)

    def _check_order(self) -> None:
        if self.order_done or self.order_index < 1 or self.order_index > 6:
            return
        _item, count = ORDERS[self.order_index]
        if self.delivered >= count:
            self._complete()

    def _close_row(self) -> None:
        note = ""
        if self.rows and False:
            note = ""
        self.rows.append(
            OrderRow(
                order=self.order_index,
                label=ORDER_LABELS[self.order_index],
                start_t=self._seg_start,
                end_t=self.t,
                hands_on=self._seg_hands,
                watch=self._seg_watch,
                drain=self._seg_drain,
                spent=self._seg_spent,
                refunded=self._seg_refunded,
                reward=self.cfg.rewards[self.order_index],
                wallet=self.coins,
                wallet_min=self._seg_min,
                delivered_note=note,
            )
        )

    # -- factory -------------------------------------------------------------

    def _accepts(self, dest: str, item: str) -> bool:
        kind = self.owned[dest]
        if kind == "packing_station":
            return True
        recipe = self.cfg.recipe(kind)
        if recipe is None:
            return False
        if item not in {name for name, _ in recipe.inputs}:
            return False
        runtime = self.board[dest]
        return runtime.buffers.get(item, 0) < self.cfg.input_buffer

    def _deliver(self, dest: str, item: str) -> None:
        kind = self.owned[dest]
        if kind == "packing_station":
            if (
                1 <= self.order_index <= 6
                and not self.order_done
                and item == ORDERS[self.order_index][0]
                and self.delivered < ORDERS[self.order_index][1]
            ):
                self.delivered += 1
            else:
                self.stock[item] = self.stock.get(item, 0) + 1
            return
        runtime = self.board[dest]
        runtime.buffers[item] = runtime.buffers.get(item, 0) + 1

    def step(self) -> None:
        tick = self.cfg.belt_seconds
        # Growth and crafting advance while an order is open, and also while
        # a line is draining so a craft that finishes can still be held back.
        for runtime in self.board.values():
            if runtime.kind in BEDS:
                if runtime.placed and runtime.holding is None:
                    runtime.timer -= tick
                    if runtime.timer <= 0:
                        runtime.holding = "daisy" if runtime.kind == "daisy_bed" else "lavender"
                        runtime.timer = 0.0
            elif runtime.kind in MACHINES and runtime.crafting:
                runtime.timer -= tick
                if runtime.timer <= 0:
                    recipe = self.cfg.recipe(runtime.kind)
                    assert recipe is not None
                    runtime.holding = recipe.output
                    runtime.crafting = False
                    runtime.timer = 0.0

        # Move items already on belts, downstream first, one tile per tick.
        for belt in self.belts:
            last = len(belt.slots) - 1
            if belt.slots[last] is not None and self._accepts(belt.dest, belt.slots[last]):
                self._deliver(belt.dest, belt.slots[last])
                belt.slots[last] = None
            for i in range(last - 1, -1, -1):
                if belt.slots[i] is not None and belt.slots[i + 1] is None:
                    belt.slots[i + 1] = belt.slots[i]
                    belt.slots[i] = None

        for belt in self.belts:
            if belt.slots[0] is not None:
                continue
            source = self.board.get(belt.source)
            if source is None or source.holding is None:
                continue
            belt.slots[0] = source.holding
            source.holding = None
            if source.kind in BEDS:
                source.timer = self.cfg.grow_seconds(source.kind)

        for runtime in self.board.values():
            recipe = self.cfg.recipe(runtime.kind)
            if recipe is None or runtime.crafting or runtime.holding is not None:
                continue
            if all(runtime.buffers.get(name, 0) >= count for name, count in recipe.inputs):
                for name, count in recipe.inputs:
                    runtime.buffers[name] -= count
                runtime.crafting = True
                runtime.timer = recipe.seconds

    def run_for(self, seconds: float, watch: bool, until_order: bool = False) -> None:
        """Advance the clock.

        Human gestures pass the full (pace-scaled) duration. The factory steps
        only while the active order is still open, so a celebration toast pauses
        production. A watch action instead stops the moment the order completes
        and is not scaled by pace: flowers do not grow faster for a fluent player.
        """
        duration = seconds if until_order else seconds * self.cfg.pace
        tick = self.cfg.belt_seconds
        elapsed = 0.0
        left = duration
        while left + TICK_EPSILON >= tick:
            if until_order and self.order_done:
                break
            if not self.order_done:
                self.step()
                self.t += tick
                elapsed += tick
                left -= tick
                self._check_order()
                if until_order and self.order_done:
                    break
            else:
                # Gesture finishes while the completion toast is up. Factory stays paused.
                self.t += left
                elapsed += left
                left = 0.0
                break
        if until_order and self.order_done:
            pass
        elif left > TICK_EPSILON and not until_order:
            self.t += left
            elapsed += left
        if watch or until_order:
            self.watch += elapsed
            self._seg_watch += elapsed
        else:
            self.hands_on += elapsed
            self._seg_hands += elapsed

    def _flush_removed_belts(self, links: tuple[tuple[str, str, int], ...]) -> None:
        """Belts that are not in the new layout finish their current items.

        Items already on a removed belt are delivered to that belt's destination.
        Time charged is one traversal of the longest occupied belt being removed,
        because every belt moves at once. Links that stay (same source, destination,
        and length) keep the items sitting on them.
        """
        new_keys = {(src, dst, length) for src, dst, length in links}
        kept: dict[tuple[str, str, int], list[str | None]] = {}
        removed: list[Belt] = []
        for belt in self.belts:
            key = (belt.source, belt.dest, len(belt.slots))
            if key in new_keys and key not in kept:
                kept[key] = list(belt.slots)
            else:
                removed.append(belt)
        occupied = [belt for belt in removed if any(slot is not None for slot in belt.slots)]
        if occupied:
            flush = max(len(belt.slots) for belt in occupied) * self.cfg.belt_seconds
            self.t += flush
            self.drain_time += flush
            self._seg_drain += flush
            for belt in occupied:
                for slot in belt.slots:
                    if slot is not None:
                        self._deliver(belt.dest, slot)
            self._check_order()
        self.belts = [
            Belt(src, dst, kept.get((src, dst, length), [None] * length))
            for src, dst, length in links
        ]

    def apply_layout(self, name: str) -> None:
        layout = LAYOUTS[name]
        for eid, kind in layout.entities:
            if eid not in self.owned:
                raise SoftLock(f"layout {name} needs unowned {eid} ({kind})")
            if self.owned[eid] != kind:
                raise SoftLock(f"layout {name} has {eid} as {kind}, owned as {self.owned[eid]}")
        owned_ids = {eid for eid, _ in layout.entities}
        for eid in list(self.board):
            if eid not in owned_ids:
                # Parked in storage. Refuse if it is holding a flower or a craft.
                runtime = self.board[eid]
                if runtime.holding or runtime.crafting or any(runtime.buffers.values()):
                    raise SoftLock(f"cannot store {eid}: it still holds items")
                del self.board[eid]
        for eid, kind in layout.entities:
            if eid not in self.board:
                runtime = Runtime(kind, placed=True)
                if kind in BEDS:
                    runtime.timer = self.cfg.grow_seconds(kind)
                self.board[eid] = runtime
            else:
                self.board[eid].placed = True
        new_count = layout.belt_tiles
        old_count = sum(len(belt.slots) for belt in self.belts)
        delta = new_count - old_count
        if delta > 0:
            self._pay(delta * self.cfg.belt, f"{delta} belts for {name}")
        elif delta < 0:
            refund = (-delta) * self.cfg.belt  # belts refund 100%
            self._gain(refund, f"{-delta} belts picked up", refund=True)
        # Flush while old destinations are still on the board, then relink.
        self._flush_removed_belts(layout.links)
        self.layout_name = name

    def buy(self, kind: str, eid: str) -> None:
        if kind not in self.unlocks:
            raise SoftLock(f"{kind} is locked at order {self.order_index}")
        if eid in self.owned:
            raise SoftLock(f"{eid} already owned")
        self._pay(self.cfg.cost(kind), f"buy {kind} ({eid})")
        self.owned[eid] = kind

    def sell(self, eid: str) -> None:
        if eid not in self.owned:
            raise SoftLock(f"cannot sell unknown {eid}")
        if eid == "pack":
            raise SoftLock("packing station cannot be sold")
        runtime = self.board.get(eid)
        if runtime is not None and (
            runtime.holding or runtime.crafting or any(runtime.buffers.values())
        ):
            raise SoftLock(f"cannot sell {eid}: it still holds items")
        if any(slot is not None and belt.source == eid for belt in self.belts for slot in belt.slots):
            raise SoftLock(f"cannot sell {eid}: its belt still holds items")
        kind = self.owned.pop(eid)
        self.board.pop(eid, None)
        # Drop links that touched it so a later layout delta is honest.
        kept: list[Belt] = []
        removed_tiles = 0
        for belt in self.belts:
            if belt.source == eid or belt.dest == eid:
                if any(slot is not None for slot in belt.slots):
                    raise SoftLock(f"cannot pick up belts out of {eid}: items on them")
                removed_tiles += len(belt.slots)
            else:
                kept.append(belt)
        self.belts = kept
        if removed_tiles:
            self._gain(removed_tiles * self.cfg.belt, f"belts from {eid}", refund=True)
        refund = self.cfg.building_refund(kind)
        self._gain(refund, f"refund {kind}", refund=True)

    def buy_expansion(self) -> None:
        if "expansion" not in self.unlocks:
            raise SoftLock("expansion is still locked")
        if self.expansion:
            raise SoftLock("expansion already bought")
        self._pay(self.cfg.expansion, "buy 20×14 expansion")
        self.expansion = True

    def tile_count(self) -> tuple[int, int]:
        structures = sum(1 for runtime in self.board.values() if runtime.placed)
        belts = sum(len(belt.slots) for belt in self.belts)
        return structures + belts, belts


def run_script(cfg: Config, name: str, script: list[Act], extra_waste: int = 0) -> RunResult:
    sim = Sim(cfg)
    try:
        if extra_waste:
            sim._pay(extra_waste, "coins wasted up front")
        sim.start_order(1)
        for act in script:
            if act.kind == "think":
                sim.run_for(act.seconds, watch=False)
            elif act.kind == "buy":
                assert act.item and act.eid
                sim.buy(act.item, act.eid)
                sim.run_for(act.seconds, watch=False)
            elif act.kind == "sell":
                assert act.eid
                sim.sell(act.eid)
                sim.run_for(act.seconds, watch=False)
            elif act.kind == "layout":
                assert act.layout
                sim.apply_layout(act.layout)
                sim.run_for(act.seconds, watch=False)
            elif act.kind == "wait":
                sim.run_for(180, watch=True, until_order=True)
                if not sim.order_done:
                    raise SoftLock(
                        f"order {sim.order_index} did not complete within 180s of watching"
                    )
            elif act.kind == "celebrate":
                if not sim.order_done:
                    raise SoftLock(f"celebration before order {sim.order_index} finished")
                sim.run_for(act.seconds, watch=False)
                finished = sim.order_index
                sim._close_row()
                if finished < 6:
                    sim.start_order(finished + 1)
            elif act.kind == "expansion":
                sim.buy_expansion()
                sim.run_for(act.seconds, watch=False)
            elif act.kind == "ending":
                sim.run_for(act.seconds, watch=False)
            else:
                raise SoftLock(f"unknown action {act.kind}")
        if len(sim.rows) != 6:
            raise SoftLock(f"finished with {len(sim.rows)} orders")
        tiles, belts = sim.tile_count()
        return RunResult(
            name=name,
            ok=True,
            message="cleared all 6 orders",
            total_t=sim.t,
            coins=sim.coins,
            rows=sim.rows,
            tiles=tiles,
            belts=belts,
            expansion=sim.expansion,
            min_wallet=sim.min_wallet,
            hands_on=sim.hands_on,
            watch=sim.watch,
            ledger=sim.ledger,
        )
    except SoftLock as exc:
        tiles, belts = sim.tile_count()
        if sim.order_index and (not sim.rows or sim.rows[-1].order != sim.order_index):
            if sim.order_done:
                sim._close_row()
        return RunResult(
            name=name,
            ok=False,
            message=exc.message,
            total_t=sim.t,
            coins=sim.coins,
            rows=sim.rows,
            tiles=tiles,
            belts=belts,
            expansion=sim.expansion,
            min_wallet=sim.min_wallet,
            hands_on=sim.hands_on,
            watch=sim.watch,
            ledger=sim.ledger,
        )


def cold_order(cfg: Config, layout_name: str, order_index: int) -> float:
    """Factory time for one order from an idle line with that layout already built."""
    sim = Sim(cfg)
    for eid, kind in LAYOUTS[layout_name].entities:
        if eid == "pack":
            continue
        sim.unlocks.add(kind)
        sim.owned[eid] = kind
    # Start the requested order without charging, then drop the layout in.
    sim.start_order(order_index)
    sim.apply_layout(layout_name)
    # apply_layout charges belts. Refund that so this benchmark is time-only.
    sim.coins = cfg.start_coins
    guard = 0.0
    while not sim.order_done:
        sim.step()
        sim.t += cfg.belt_seconds
        sim._check_order()
        guard += cfg.belt_seconds
        if guard > 300:
            raise RuntimeError(f"cold order {order_index} on {layout_name} did not finish")
    return sim.t


def teardown_cycles(cfg: Config) -> int:
    """How many times the starter chain can be built, sold, and built again."""
    cost = comfortable_chain_cost(cfg)
    refund = (
        cfg.building_refund("daisy_bed")
        + cfg.building_refund("bundling_table")
        + COMFORTABLE_BELT_COUNT * cfg.belt
    )
    coins = cfg.start_coins
    cycles = 0
    if coins < cost:
        return 0
    coins -= cost
    cycles = 1
    while True:
        coins += refund
        if coins < cost:
            return cycles
        coins -= cost
        cycles += 1


def waste_headroom(cfg: Config, script: list[Act]) -> int:
    """Extra coins burned at the very start on top of a script, and it still clears."""
    lo = 0
    hi = cfg.start_coins
    best = 0
    while lo <= hi:
        mid = (lo + hi) // 2
        result = run_script(cfg, "headroom", script, extra_waste=mid)
        if result.ok:
            best = mid
            lo = mid + 1
        else:
            hi = mid - 1
    return best


# ---------------------------------------------------------------------------
# Timing micro-checks. These lock the belt model to a hand-computed clock.
# ---------------------------------------------------------------------------


def check_travel_model(cfg: Config) -> list[str]:
    """Return failure strings. Empty means the clock matches the hand math."""
    problems: list[str] = []

    sim = Sim(cfg)
    sim.unlocks.add("daisy_bed")
    sim.owned["bed1"] = "daisy_bed"
    sim.start_order(1)
    sim.coins = 10_000
    sim.apply_layout("c1")  # 4-tile belt, but c1 is the careful layout
    # Hand math for a 4-tile belt: first daisy enters at t=4, exits after 4 ticks.
    sim.coins = cfg.start_coins
    while sim.delivered < 1:
        sim.step()
        sim.t += cfg.belt_seconds
        sim._check_order()
    expected_first = cfg.daisy_seconds + 4 * cfg.belt_seconds
    if abs(sim.t - expected_first) > 1e-6:
        problems.append(f"first daisy on 4 belts arrived at {sim.t}, expected {expected_first}")
    while sim.delivered < 2:
        sim.step()
        sim.t += cfg.belt_seconds
        sim._check_order()
    expected_second = cfg.daisy_seconds * 2 + 4 * cfg.belt_seconds
    if abs(sim.t - expected_second) > 1e-6:
        problems.append(f"second daisy arrived at {sim.t}, expected {expected_second}")

    # Bundle: bed -2- bundler -2- pack. First bundle = 2nd daisy travel + craft + out travel.
    # Daisy n enters the belt at t = 4n, exits a 2-belt after 2 ticks.
    # Craft starts when daisy 2 arrives, lasts 5s, then 2 ticks to packing.
    sim = Sim(cfg)
    sim.unlocks.update({"daisy_bed", "bundling_table"})
    sim.owned["bed1"] = "daisy_bed"
    sim.owned["bundler"] = "bundling_table"
    sim.start_order(2)
    sim.coins = 10_000
    sim.apply_layout("c2")
    while sim.delivered < 1 and sim.t < 60:
        sim.step()
        sim.t += cfg.belt_seconds
        sim._check_order()
    # t_arrive_daisy2 = 8 + 1.0 = 9; craft done 14; packing 15.
    expected_bundle = cfg.daisy_seconds * 2 + 2 * cfg.belt_seconds + cfg.bundle_seconds + 2 * cfg.belt_seconds
    if abs(sim.t - expected_bundle) > 1e-6:
        problems.append(f"first bundle arrived at {sim.t}, expected {expected_bundle}")
    return problems


# ---------------------------------------------------------------------------
# Report
# ---------------------------------------------------------------------------


def fmt(seconds: float) -> str:
    total = int(round(seconds))
    return f"{total // 60}:{total % 60:02d}"


def fmt_signed(seconds: float) -> str:
    total = int(round(seconds))
    sign = "-" if total < 0 else ""
    total = abs(total)
    return f"{sign}{total // 60}:{total % 60:02d}"


def print_curve(result: RunResult) -> None:
    status = "OK" if result.ok else "SOFTLOCK"
    print(f"### {result.name} — {status}")
    print(result.message)
    if not result.rows and not result.ok:
        print()
        return
    print()
    print("| Order | Request | Clock | Segment | Hands-on | Watching | Line flush | Spent | Refunded | Reward | Wallet | Low point |")
    print("| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    for row in result.rows:
        segment = row.end_t - row.start_t
        print(
            f"| {row.order} | {row.label} | {fmt(row.end_t)} | {fmt(segment)} "
            f"| {fmt(row.hands_on)} | {fmt(row.watch)} | {fmt(row.drain)} "
            f"| {row.spent} | {row.refunded} | {row.reward} | {row.wallet} | {row.wallet_min} |"
        )
    print()
    if result.ok:
        print(
            f"Session {fmt(result.total_t)} ({result.total_t / 60:.1f} min). "
            f"Hands-on {fmt(result.hands_on)}, watching the line {fmt(result.watch)}, "
            f"flushing belts {fmt(sum(row.drain for row in result.rows))}."
        )
        print(
            f"Ends with {result.coins} coins. Lowest wallet during the run: {result.min_wallet}. "
            f"Placed tiles at the end: {result.tiles} (belts {result.belts}). "
            f"Expansion bought: {'yes' if result.expansion else 'no'}."
        )
    else:
        print(f"Stopped at {fmt(result.total_t)} with {result.coins} coins.")
        if result.ledger:
            print("Last ledger lines:")
            for line in result.ledger[-8:]:
                print(f"  {line}")
    print()


def copy_tables(cfg: Config) -> str:
    rows = [
        ("daisy_bed", "Daisy Bed", cfg.daisy_bed, cfg.building_refund("daisy_bed"), "Order 1 (start)"),
        ("lavender_bed", "Lavender Bed", cfg.lavender_bed, cfg.building_refund("lavender_bed"), "Order 4"),
        ("belt", "Conveyor Belt", cfg.belt, cfg.belt, "Order 1 (start)"),
        ("bundling_table", "Bundling Table", cfg.bundling_table, cfg.building_refund("bundling_table"), "Order 1 (start)"),
        ("drying_bench", "Drying Bench", cfg.drying_bench, cfg.building_refund("drying_bench"), "Order 5"),
        ("arrangement_table", "Arrangement Table", cfg.arrangement_table, cfg.building_refund("arrangement_table"), "Order 6"),
        ("packing_station", "Packing Station", cfg.packing_station, 0, "Pre-placed, cannot be sold"),
        ("expansion", "Garden expansion 20×14", cfg.expansion, 0, "Order 4, optional, permanent"),
    ]
    lines = [
        f"Starting coins: {cfg.start_coins}",
        "",
        "| id | Name | Cost | Refund | Available |",
        "| --- | --- | ---: | ---: | --- |",
    ]
    for rid, name, cost, refund, when in rows:
        lines.append(f"| `{rid}` | {name} | {cost} | {refund} | {when} |")
    lines += [
        "",
        "| Order | Request | Reward | Unlocks when the order starts |",
        "| ---: | --- | ---: | --- |",
        f"| 1 | 2 daisies | {cfg.rewards[1]} | Daisy Bed, Conveyor Belt, Bundling Table, Packing Station |",
        f"| 2 | 2 Daisy Bundles | {cfg.rewards[2]} | — |",
        f"| 3 | 4 Daisy Bundles | {cfg.rewards[3]} | — |",
        f"| 4 | 2 lavender | {cfg.rewards[4]} | Lavender Bed, garden expansion |",
        f"| 5 | 2 Lavender Sachets | {cfg.rewards[5]} | Drying Bench |",
        f"| 6 | 1 Mixed Bouquet | {cfg.rewards[6]} | Arrangement Table |",
        "",
        "| Process | Seconds |",
        "| --- | ---: |",
        f"| Daisy Bed cycle | {cfg.daisy_seconds:.0f} |",
        f"| Lavender Bed cycle | {cfg.lavender_seconds:.0f} |",
        f"| Bundling Table (2 daisies) | {cfg.bundle_seconds:.0f} |",
        f"| Drying Bench (2 lavender) | {cfg.sachet_seconds:.0f} |",
        f"| Arrangement Table (1 bundle + 1 sachet) | {cfg.bouquet_seconds:.0f} |",
        f"| Conveyor belt, per tile | {cfg.belt_seconds:.1f} |",
        f"| Machine input buffer, per ingredient | {cfg.input_buffer} |",
        "",
        "Refund rule: buildings pay `cost * 3 // 4`. Belts pay the full cost. "
        "Packing and expansion pay nothing back.",
    ]
    return "\n".join(lines)


def hands_on_breakdown(script: list[Act], pace: float) -> str:
    totals = [0.0] * 7
    for act in script:
        if act.kind == "wait":
            continue
        totals[act.order] += act.seconds * pace
    lines = ["| Order | Scripted hands-on (excludes factory watching) |", "| ---: | ---: |"]
    for i in range(1, 7):
        lines.append(f"| {i} | {fmt(totals[i])} |")
    lines.append(f"| Total | {fmt(sum(totals))} |")
    return "\n".join(lines)


def main() -> int:
    cfg = Config()
    trace = "--trace" in sys.argv
    problems: list[str] = []

    print("Petalworks balance simulation")
    print("Command: python3 tools/balance/simulate.py")
    print()
    print(copy_tables(cfg))
    print()
    print(
        f"Comfortable Daisy Bundle chain (1 bed + 1 bundler + {COMFORTABLE_BELT_COUNT} belts "
        f"+ free packing): {comfortable_chain_cost(cfg)} coins."
    )
    print(
        f"Straight minimum (2 belts): {minimum_chain_cost(cfg)} coins. "
        f"Start {cfg.start_coins} covers the comfortable chain with "
        f"{cfg.start_coins - comfortable_chain_cost(cfg)} left over."
    )
    cycles = teardown_cycles(cfg)
    print(
        f"Starter chain can be built and fully sold {cycles} times before the "
        f"next rebuild is unaffordable (no order rewards yet)."
    )
    print()

    travel_problems = check_travel_model(cfg)
    problems.extend(travel_problems)
    if travel_problems:
        print("Travel model mismatches:")
        for item in travel_problems:
            print(f"  - {item}")
    else:
        print("Belt travel matches the hand-computed daisy and bundle clocks.")
    print()

    cold = {
        "order 1, 4-tile belt": cold_order(cfg, "c1", 1),
        "order 2, one bed": cold_order(cfg, "c2", 2),
        "order 3, one bed": cold_order(cfg, "f3", 3),
        "order 3, two beds": cold_order(cfg, "c3", 3),
        "order 4, lavender to packing": cold_order(cfg, "f4", 4),
        "order 5, one dryer": cold_order(cfg, "f5", 5),
        "order 6, one daisy bed": cold_order(cfg, "f6", 6),
        "order 6, two daisy beds": cold_order(cfg, "c6", 6),
    }
    print("Cold factory times (line already built, nothing in stock, 1× speed):")
    for label, seconds in cold.items():
        print(f"  {label:<32} {fmt(seconds)}  ({seconds:.1f}s)")
    cold_sum = cold["order 1, 4-tile belt"] + cold["order 2, one bed"] + cold["order 3, one bed"]
    cold_sum += cold["order 4, lavender to packing"] + cold["order 5, one dryer"] + cold["order 6, one daisy bed"]
    print(f"  Sum of one-bed cold orders:     {fmt(cold_sum)}  ({cold_sum:.1f}s)")
    print()

    profiles = [
        ("Careful first-time player", careful_script(), 0),
        ("Wasteful first-time player", wasteful_script(), 0),
        ("Frugal player (one daisy bed, no expansion)", frugal_script(), 0),
        ("Eager player (bundle chain before the first daisy)", eager_script(), 0),
    ]
    results: dict[str, RunResult] = {}
    for name, script, extra in profiles:
        result = run_script(cfg, name, script, extra_waste=extra)
        results[name] = result
        print_curve(result)
        if trace and result.ledger:
            print("Ledger:")
            for line in result.ledger:
                print(" ", line)
            print()

    fluent_cfg = replace(cfg, pace=0.45)
    fluent = run_script(fluent_cfg, "Fluent returning player (same layout, 0.45× hands-on)", careful_script())
    print_curve(fluent)

    stress = run_script(cfg, "Stress: wasteful plus a spare Drying Bench", stress_script())
    print_curve(stress)

    headroom = waste_headroom(cfg, wasteful_script())
    print(
        f"Waste headroom: the wasteful script still clears if {headroom} additional "
        f"coins are thrown away at the start and never refunded."
    )
    print()

    half_cfg = replace(cfg, building_refund_num=1, building_refund_den=2)
    half = run_script(half_cfg, "Sensitivity: 50% building refund, wasteful script", wasteful_script())
    print_curve(half)
    print(f"Teardown cycles at a 50% building refund: {teardown_cycles(half_cfg)}.")
    print()

    slow_cfg = replace(cfg, belt_seconds=1.0)
    # Cold times change; player scripts do not. Rerun careful only for the clock.
    slow = run_script(slow_cfg, "Sensitivity: 1.0s belt tiles, careful script", careful_script())
    print(
        f"Slow belts add {fmt_signed(slow.total_t - results['Careful first-time player'].total_t)} "
        f"to the careful session ({fmt(slow.total_t)} total)."
    )
    print()

    careful = results["Careful first-time player"]
    wasteful = results["Wasteful first-time player"]
    frugal = results["Frugal player (one daisy bed, no expansion)"]
    eager = results["Eager player (bundle chain before the first daisy)"]

    def require(cond: bool, message: str) -> None:
        if not cond:
            problems.append(message)

    require(not travel_problems, "travel model failed")
    require(careful.ok, f"careful softlocked: {careful.message}")
    require(wasteful.ok, f"wasteful softlocked: {wasteful.message}")
    require(frugal.ok, f"frugal softlocked: {frugal.message}")
    require(eager.ok, f"eager softlocked: {eager.message}")
    require(15 * 60 <= careful.total_t <= 30 * 60, f"careful session {careful.total_t:.1f}s outside 15–30 min")
    require(15 * 60 <= wasteful.total_t <= 30 * 60, f"wasteful session {wasteful.total_t:.1f}s outside 15–30 min")
    require(wasteful.total_t > careful.total_t, "wasteful session should run longer than careful")
    require(cfg.start_coins >= comfortable_chain_cost(cfg), "start cannot buy the comfortable bundle chain")
    require(cycles >= 3, f"only {cycles} starter-chain builds before a softlock")
    require(careful.min_wallet >= 0 and wasteful.min_wallet >= 0, "negative wallet")
    require(headroom >= 30, f"waste headroom {headroom} is under 30 coins")
    require(cold_sum < 10 * 60, f"cold factory sum {cold_sum:.1f}s is a grind")
    require(careful.tiles <= 16 * 12, f"careful layout uses {careful.tiles} tiles")
    require(wasteful.tiles <= 16 * 12, f"wasteful layout uses {wasteful.tiles} tiles, expansion would be mandatory")
    require(not careful.expansion, "careful player should not need the expansion")
    require(wasteful.expansion, "wasteful scenario should actually buy the expansion")
    # Generous: finale reward is the biggest, and the careful player ends richer than they started.
    require(cfg.rewards[6] == max(cfg.rewards), "finale reward should be the largest")
    require(careful.coins > cfg.start_coins, "careful player should end with more than they started")
    require(wasteful.coins > 0, "wasteful player should finish with coins left")
    # Each processed-good reward covers that order's new machine for a player who still has the machine to buy.
    require(cfg.rewards[2] >= cfg.bundling_table, "bundle reward should cover a bundler")
    require(cfg.rewards[5] >= cfg.drying_bench, "sachet reward should cover a dryer")
    require(cfg.rewards[6] > cfg.arrangement_table, "bouquet reward should more than cover the arrangement table")
    for kind in ("daisy_bed", "lavender_bed", "bundling_table", "drying_bench", "arrangement_table"):
        require(cfg.building_refund(kind) == cfg.cost(kind) * 3 // 4, f"refund mismatch for {kind}")

    print("Hands-on time assumed for the careful script (factory watching is extra, measured above):")
    print(hands_on_breakdown(careful_script(), cfg.pace))
    print()
    print("Hands-on time assumed for the wasteful script:")
    print(hands_on_breakdown(wasteful_script(), cfg.pace))
    print()

    if problems:
        print("CHECKS FAILED")
        for item in problems:
            print(f"  - {item}")
        return 1

    print("CHECKS PASSED")
    print(
        f"Careful {fmt(careful.total_t)}, wasteful {fmt(wasteful.total_t)}, "
        f"frugal {fmt(frugal.total_t)}, eager {fmt(eager.total_t)}, "
        f"fluent {fmt(fluent.total_t)}."
    )
    print(
        f"Stress spare dryer: {'clears' if stress.ok else 'softlocks'} ({stress.message}). "
        f"50% refund wasteful: {'clears' if half.ok else 'softlocks'}."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
