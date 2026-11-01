#!/usr/bin/env python3
"""Check docs/content/copy.json against the copy-pass rules.

Compares the key set to main's copy.json, then scans string values for
punctuation and banned words. Exits 0 on pass.
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
    if now_keys != old_keys:
        missing = [k for k in old_keys if k not in now_keys]
        extra = [k for k in now_keys if k not in old_keys]
        problems.append(f"key mismatch missing={missing[:8]} extra={extra[:8]}")

    old_leaves = dict(leaves(baseline))
    new_leaves = dict(leaves(data))
    for path, value in new_leaves.items():
        old = old_leaves.get(path)
        if type(value) is not type(old):
            problems.append(f"type changed at {path}: {type(old).__name__} -> {type(value).__name__}")
        if not isinstance(value, str):
            if value != old:
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
        old_tokens = set(re.findall(r"\{[a-zA-Z]+\}", old if isinstance(old, str) else ""))
        new_tokens = set(re.findall(r"\{[a-zA-Z]+\}", value))
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
    print(f"keys: {len(now_keys)} (same order: {now_keys == old_keys})")
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
