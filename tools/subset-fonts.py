#!/usr/bin/env python3
"""Subsets the Nunito TTFs in src/ui/fonts to the glyphs the game can show and writes
woff2 files next to them. Run after copy.json or the UI text changes; commit the output.
Needs: pip install fonttools brotli
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / "src" / "ui" / "fonts"

chars: set[str] = set()


def take(text: str) -> None:
    chars.update(ch for ch in text if not ch.isspace() or ch == " ")


def walk(o) -> None:
    if isinstance(o, dict):
        for v in o.values():
            walk(v)
    elif isinstance(o, list):
        for v in o:
            walk(v)
    elif isinstance(o, str):
        take(o)


walk(json.loads((ROOT / "docs/content/copy.json").read_text(encoding="utf-8")))
for p in list((ROOT / "src/ui").glob("*.ts")) + list((ROOT / "src/ui").glob("*.tsx")) + [ROOT / "src/app/store.ts", ROOT / "src/game/PetalScene.ts"]:
    for m in re.finditer(r"'((?:[^'\\]|\\.)*)'|\"((?:[^\"\\]|\\.)*)\"|`((?:[^`\\]|\\.)*)`", p.read_text(encoding="utf-8")):
        take(m.group(1) or m.group(2) or m.group(3) or "")

# Always keep the basics so numbers, names a player types nowhere, and future copy render.
for lo, hi in ((0x20, 0x7E), (0xA0, 0xFF), (0x2010, 0x2027), (0x2032, 0x203A)):
    chars.update(chr(c) for c in range(lo, hi + 1))
chars.update("×·→−…€")

text = "".join(sorted(chars))
(FONTS / "glyphs.txt").write_text(text, encoding="utf-8")
print(f"{len(chars)} glyphs")

for weight in ("400", "600", "700", "800"):
    src = FONTS / f"Nunito-{weight}.ttf"
    out = FONTS / f"Nunito-{weight}.woff2"
    subprocess.run(
        [
            "pyftsubset", str(src), f"--text-file={FONTS / 'glyphs.txt'}", "--flavor=woff2", f"--output-file={out}",
            "--layout-features=kern,liga,calt,ccmp,mark,mkmk,locl", "--no-hinting", "--desubroutinize", "--name-IDs=1,2,3,4,6",
        ],
        check=True,
    )
    print(f"{out.name}: {src.stat().st_size} -> {out.stat().st_size} bytes")
