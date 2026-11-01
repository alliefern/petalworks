#!/usr/bin/env python3
"""Check docs/content/copy.json against the copy-pass rules.

Baseline keys must match main's copy.json, in the same order. The extra
section is the leftover UI strings: the checker requires those keys and
their placeholders, and scans every string for punctuation and banned words.
Exits 0 on pass.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
COPY = ROOT / "docs" / "content" / "copy.json"
MD = ROOT / "docs" / "content" / "COPY.md"

# Whole words only, matched in string values (keys such as unlocks stay).
BANNED = [
    "seamless",
    "unlock",
    "unlocked",
    "unlocks",
    "elevate",
    "empower",
    "leverage",
    "robust",
    "comprehensive",
    "holistic",
    "synergy",
    "tapestry",
    "realm",
    "journey",
    "landscape",
    "ecosystem",
    "cutting-edge",
    "game-changer",
    "game changer",
    "revolutionize",
    "transformative",
    "transform",
    "streamline",
    "optimize",
    "facilitate",
    "utilize",
    "demystify",
    "underscore",
    "testament",
    "delve",
    "navigate",
    "foster",
    "harness",
    "embark",
    "pivotal",
    "paramount",
    "crucial",
    "vital",
    "meticulous",
    "intricate",
    "nuanced",
    "multifaceted",
    "vibrant",
    "bustling",
    "thriving",
    "dynamic",
    "innovative",
    "groundbreaking",
    "quietly",
    "supercharge",
    "beacon",
    "ever-evolving",
    "level up",
    "grindset",
    "girlboss",
    "safe space",
]

BAD_CHARS = {
    "\u2014": "em dash",
    "\u2013": "en dash",
    "\u2018": "left single quote",
    "\u2019": "right single quote",
    "\u201c": "left double quote",
    "\u201d": "right double quote",
    "\u2026": "ellipsis char",
    "\u00a0": "nbsp",
}

CONTRAST = re.compile(
    r"\bnot\b.{0,40}\bit(?:'s| is)\b|\binstead of\b|\bless\b.+\bmore\b",
    re.IGNORECASE,
)

BRITISH = re.compile(
    r"\b(colour|colours|favour|favourite|honour|grey|centre|cosy|practise)\b",
    re.IGNORECASE,
)

# Leftover UI strings. Paths are the leaves under extra. Tokens include braces.
# A dropped key, a new key, or a changed placeholder fails the check.
EXTRA_LEAF_PATHS = (
    'extra.settings.paused',
    'extra.settings.soundHelp',
    'extra.settings.musicHelp',
    'extra.settings.tutorial',
    'extra.settings.tutorialHelp',
    'extra.settings.newGame',
    'extra.settings.newGameHelp',
    'extra.settings.newGameButton',
    'extra.settings.keep',
    'extra.settings.backToGarden',
    'extra.hud.orders',
    'extra.hud.speed',
    'extra.hud.speedN',
    'extra.hud.zoomIn',
    'extra.hud.zoomOut',
    'extra.hud.fit',
    'extra.hud.fitTooltip',
    'extra.hud.tips',
    'extra.hud.tipsTooltip',
    'extra.hud.orderOf',
    'extra.hud.forCustomer',
    'extra.hud.sandboxBody',
    'extra.hud.ordersDone',
    'extra.a11y.gameHelp',
    'extra.a11y.speedN',
    'extra.a11y.notices',
    'extra.a11y.cursorTile',
    'extra.a11y.emptyTile',
    'extra.a11y.skipToGarden',
    'extra.palette.refund',
    'extra.palette.facing',
    'extra.palette.rotateHint',
    'extra.palette.clickToPlace',
    'extra.palette.releaseToLay',
    'extra.palette.beltsCount',
    'extra.palette.beltCount',
    'extra.palette.removeWhat',
    'extra.palette.refundLine',
    'extra.palette.staysInYard',
    'extra.palette.placeItem',
    'extra.palette.needsBelt',
    'extra.palette.dropHere',
    'extra.palette.expandLine',
    'extra.blocked.headOn',
    'extra.blocked.stockFull',
    'extra.blocked.stockFullDetail',
    'extra.states.movesEvery',
    'extra.states.growsEvery',
    'extra.states.outputLeaves',
    'extra.states.takesAnySide',
    'extra.states.received',
    'extra.states.readyCount',
    'extra.states.packingSandbox',
    'extra.states.packingCap',
    'extra.states.refused',
    'extra.inspector.recipeSeconds',
    'extra.inspector.holding',
    'extra.inspector.rotateTip',
    'extra.inspector.removeTip',
    'extra.celebration.expansionName',
    'extra.celebration.unlockGeneric',
    'extra.ending.ordersFilled',
    'extra.ending.itemsDelivered',
    'extra.ending.coinsEarned',
    'extra.tutorial.helpTitle',
    'extra.tutorial.mouse',
    'extra.errors.notRemovable',
    'extra.errors.packingNoFacing',
    'extra.errors.undoTaken',
    'extra.errors.undoFunds',
    'extra.errors.basketEmpty',
    'extra.errors.expansionDone',
    'extra.errors.expansionLocked',
    'extra.controlsExtra[0][0]',
    'extra.controlsExtra[0][1]',
    'extra.controlsExtra[1][0]',
    'extra.controlsExtra[1][1]',
    'extra.controlsExtra[2][0]',
    'extra.controlsExtra[2][1]',
    'extra.controlsExtra[3][0]',
    'extra.controlsExtra[3][1]',
    'extra.controlsExtra[4][0]',
    'extra.controlsExtra[4][1]',
    'extra.controlsExtra[5][0]',
    'extra.controlsExtra[5][1]',
    'extra.controlsExtra[6][0]',
    'extra.controlsExtra[6][1]',
    'extra.controlsExtra[7][0]',
    'extra.controlsExtra[7][1]',
    'extra.controlsExtra[8][0]',
    'extra.controlsExtra[8][1]',
    'extra.controlsExtra[9][0]',
    'extra.controlsExtra[9][1]',
    'extra.controlsExtra[10][0]',
    'extra.controlsExtra[10][1]',
)

EXTRA_TOKENS: dict[str, set[str]] = {
    'extra.hud.speedN': {'{n}'},
    'extra.hud.orderOf': {'{n}', '{total}'},
    'extra.hud.forCustomer': {'{customer}'},
    'extra.hud.ordersDone': {'{done}', '{total}'},
    'extra.a11y.speedN': {'{n}'},
    'extra.a11y.cursorTile': {'{what}', '{x}', '{y}'},
    'extra.palette.facing': {'{facing}'},
    'extra.palette.beltsCount': {'{cost}', '{n}'},
    'extra.palette.beltCount': {'{cost}'},
    'extra.palette.removeWhat': {'{name}'},
    'extra.palette.refundLine': {'{coins}'},
    'extra.palette.staysInYard': {'{name}'},
    'extra.palette.placeItem': {'{item}'},
    'extra.blocked.stockFullDetail': {'{item}'},
    'extra.states.movesEvery': {'{seconds}'},
    'extra.states.growsEvery': {'{item}', '{seconds}'},
    'extra.states.outputLeaves': {'{facing}'},
    'extra.states.takesAnySide': {'{facing}'},
    'extra.states.received': {'{count}'},
    'extra.states.readyCount': {'{n}'},
    'extra.states.packingCap': {'{cap}'},
    'extra.states.refused': {'{item}'},
    'extra.inspector.recipeSeconds': {'{line}', '{seconds}'},
    'extra.celebration.unlockGeneric': {'{name}'},
    'extra.errors.notRemovable': {'{name}'},
}

def key_paths(node, prefix=""):
    if isinstance(node, dict):
        for key, value in node.items():
            path = f"{prefix}.{key}" if prefix else key
            yield path
            yield from key_paths(value, path)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            path = f"{prefix}[{index}]"
            yield path
            yield from key_paths(value, path)


def leaves(node, prefix=""):
    if isinstance(node, dict):
        for key, value in node.items():
            path = f"{prefix}.{key}" if prefix else key
            yield from leaves(value, path)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from leaves(value, f"{prefix}[{index}]")
    else:
        yield prefix, node


def main() -> int:
    raw = COPY.read_text(encoding="utf-8")
    data = json.loads(raw)
    baseline_raw = subprocess.check_output(
        ["git", "show", "main:docs/content/copy.json"], cwd=ROOT, text=True
    )
    baseline = json.loads(baseline_raw)

    problems = []
    now_keys = list(key_paths(data))
    old_keys = list(key_paths(baseline))
    baseline_kept = now_keys[: len(old_keys)] == old_keys
    if not baseline_kept:
        missing = [k for k in old_keys if k not in now_keys]
        problems.append(f"baseline key mismatch missing={missing[:8]}")
    added = now_keys[len(old_keys) :]
    bad_added = [
        k
        for k in added
        if k != "extra" and not k.startswith("extra.") and not k.startswith("extra[")
    ]
    if bad_added:
        problems.append(f"new keys outside extra: {bad_added[:8]}")
    # extra was appended after the original keys. Once main includes it, `added`
    # is empty; the section still has to be present, and the leaf list below still matches.
    if "extra" not in data:
        problems.append("missing extra section")

    old_leaves = dict(leaves(baseline))
    new_leaves = dict(leaves(data))
    missing_extra = [k for k in EXTRA_LEAF_PATHS if k not in new_leaves]
    if missing_extra:
        problems.append("extra leaves missing: " + ", ".join(missing_extra[:12]))
    for path, value in new_leaves.items():
        is_new = path not in old_leaves
        old = old_leaves.get(path)
        if not is_new and type(value) is not type(old):
            problems.append(f"type changed at {path}: {type(old).__name__} -> {type(value).__name__}")
        if not isinstance(value, str):
            if is_new:
                problems.append(f"new leaf is not a string at {path}")
            elif value != old:
                problems.append(f"non-string changed at {path}: {old!r} -> {value!r}")
            continue
        for char, name in BAD_CHARS.items():
            if char in value:
                problems.append(f"{name} in {path}")
        if CONTRAST.search(value):
            problems.append(f"contrast pattern in {path}: {value}")
        if BRITISH.search(value):
            problems.append(f"British spelling in {path}: {value}")
        low = value.lower()
        for word in BANNED:
            if re.search(rf"\b{re.escape(word)}\b", low):
                problems.append(f"banned word {word!r} in {path}: {value}")
        new_tokens = set(re.findall(r"\{[a-zA-Z]+\}", value))
        if is_new:
            if path not in EXTRA_LEAF_PATHS:
                problems.append(f"unexpected new leaf {path}")
            elif new_tokens != EXTRA_TOKENS.get(path, set()):
                problems.append(
                    f"extra tokens at {path}: {new_tokens} != {EXTRA_TOKENS.get(path, set())}"
                )
        else:
            old_tokens = set(re.findall(r"\{[a-zA-Z]+\}", old if isinstance(old, str) else ""))
            if old_tokens != new_tokens:
                problems.append(f"tokens changed at {path}: {old_tokens} -> {new_tokens}")

    md = MD.read_text(encoding="utf-8")
    for char, name in BAD_CHARS.items():
        if char in md:
            problems.append(f"{name} in COPY.md")

    # Player strings longer than a label should be quoted in the review doc.
    missing_from_md = []
    for path, value in new_leaves.items():
        if isinstance(value, str) and len(value) > 24 and value not in md:
            missing_from_md.append(path)
    if missing_from_md:
        problems.append("strings missing from COPY.md: " + ", ".join(missing_from_md))

    changed = [
        path
        for path, value in new_leaves.items()
        if value != old_leaves.get(path)
    ]
    print(f"parsed: yes")
    print(f"keys: {len(now_keys)} (baseline order kept: {baseline_kept}, added: {len(added)})")
    print(f"leaves: {len(new_leaves)}")
    print(f"changed leaves: {len(changed)}")
    if problems:
        print("FAIL")
        for item in problems:
            print(f"- {item}")
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
