#!/usr/bin/env python3
"""
Generates the INTERIM sprite set for Petalworks into assets/interim/.

These are deliberately simple, palette-faithful stand-ins so the game loads art
through the real manifest pipeline from day one. They are not the final look.
The art team replaces them file-by-file in assets/art/ (see docs/ASSET_SPECS.md).

Only Pillow is required. Everything is drawn at 4x and downsampled for soft edges.
"""
from __future__ import annotations

import math
import os
import random
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "interim"
SS = 4  # supersample factor

# ---- palette ---------------------------------------------------------------
P = {
    "cream": "#F6EBD5", "sage": "#A8B99A", "moss": "#657C58", "pink": "#E9A8AF",
    "coral": "#D77F70", "lavender": "#B7A4CE", "honey": "#DDB66C", "ink": "#39463B",
    "wood": "#B98A4E", "wood_light": "#D4A86A", "wood_dark": "#8A5F33",
    "soil": "#5E4330", "soil_light": "#7A5A41", "canvas": "#CDBB95", "canvas_dark": "#B5A17A",
    "violet": "#8E78B3", "grey_sage": "#9AA69A", "kraft": "#C9A978", "white": "#FFF9EE",
}


def hex2rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def rgba(name_or_hex: str, a: int = 255) -> tuple[int, int, int, int]:
    h = P.get(name_or_hex, name_or_hex)
    r, g, b = hex2rgb(h)
    return (r, g, b, a)


def mix(a: str, b: str, t: float) -> str:
    ra, ga, ba = hex2rgb(P.get(a, a))
    rb, gb, bb = hex2rgb(P.get(b, b))
    return "#%02x%02x%02x" % (round(ra + (rb - ra) * t), round(ga + (gb - ga) * t), round(ba + (bb - ba) * t))


def shade(c: str, f: float) -> str:
    """f < 1 darkens, f > 1 lightens (toward white)."""
    r, g, b = hex2rgb(P.get(c, c))
    if f <= 1:
        return "#%02x%02x%02x" % (round(r * f), round(g * f), round(b * f))
    t = f - 1
    return "#%02x%02x%02x" % (round(r + (255 - r) * t), round(g + (255 - g) * t), round(b + (255 - b) * t))


# ---- canvas helpers ----------------------------------------------------------
def canvas(w: int, h: int | None = None) -> Image.Image:
    h = h or w
    return Image.new("RGBA", (w * SS, h * SS), (0, 0, 0, 0))


def S(v: float) -> int:
    return round(v * SS)


def finish(img: Image.Image) -> Image.Image:
    return img.resize((img.width // SS, img.height // SS), Image.LANCZOS)


def save(img: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    finish(img).save(OUT / name, optimize=True)


def grain(img: Image.Image, strength: float = 0.10, sigma: float = 40) -> Image.Image:
    """Paper-grain texture, applied only where the image is opaque."""
    noise = Image.effect_noise(img.size, sigma).filter(ImageFilter.GaussianBlur(SS * 0.4))
    noise_rgb = Image.merge("RGB", (noise, noise, noise))
    rgb = img.convert("RGB")
    textured = ImageChops.overlay(rgb, noise_rgb)
    blended = Image.blend(rgb, textured, strength)
    out = blended.convert("RGBA")
    out.putalpha(img.getchannel("A"))
    return out


def drop_shadow(layer: Image.Image, dx: float = 5, dy: float = 6, blur: float = 4, alpha: float = 0.3) -> Image.Image:
    mask = layer.getchannel("A")
    sh = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ink = Image.new("RGBA", layer.size, rgba("ink", round(255 * alpha)))
    sh.paste(ink, (S(dx), S(dy)), mask)
    sh = sh.filter(ImageFilter.GaussianBlur(S(blur)))
    out = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    out.alpha_composite(sh)
    out.alpha_composite(layer)
    return out


def rough_edges(layer: Image.Image, width: float = 2.0, amount: float = 0.45, seed: int = 1) -> Image.Image:
    """Nibble the outline so shapes feel brushed rather than vector-clean."""
    mask = layer.getchannel("A")
    inner = mask.filter(ImageFilter.MinFilter(S(width) * 2 + 1))
    band = ImageChops.subtract(mask, inner)
    rnd = random.Random(seed)
    noise = Image.effect_noise(mask.size, 90)
    thr = round(255 * amount)
    keep = noise.point(lambda v: 255 if v > thr else 0)
    keep = keep.filter(ImageFilter.GaussianBlur(S(0.6)))
    band_keep = ImageChops.multiply(band, keep)
    new_alpha = ImageChops.add(inner, band_keep)
    out = layer.copy()
    out.putalpha(new_alpha)
    _ = rnd
    return out


def light_gradient(layer: Image.Image, strength: float = 0.18) -> Image.Image:
    """Lighten top-left, darken bottom-right, inside the layer's alpha."""
    w, h = layer.size
    grad = Image.linear_gradient("L").resize((w, h))  # top black -> bottom white
    grad = grad.rotate(-45, expand=False, resample=Image.BILINEAR, fillcolor=128)
    grad = ImageOps.invert(grad)  # top-left bright
    rgb = layer.convert("RGB")
    lighter = ImageChops.add(rgb, Image.new("RGB", (w, h), (255, 255, 255)), scale=1 / (1 - strength * 0.5) if False else 1.0, offset=0)
    # manual blend: rgb * (1 + (grad-128)/128 * strength)
    factor = grad.point(lambda v: int(min(255, max(0, 128 + (v - 128) * strength * 2))))
    frgb = Image.merge("RGB", (factor, factor, factor))
    bright = ImageChops.multiply(rgb, frgb.point(lambda v: min(255, v * 2)))
    out = ImageChops.blend(rgb, bright, 1.0).convert("RGBA")
    _ = lighter
    out.putalpha(layer.getchannel("A"))
    return out


def painted(layer: Image.Image, shadow: bool = True, rough: float = 1.5, grain_strength: float = 0.12, seed: int = 1,
            shadow_alpha: float = 0.3, dx: float = 4, dy: float = 5) -> Image.Image:
    """Standard finishing for a solid shape layer."""
    out = light_gradient(layer)
    out = grain(out, grain_strength)
    if rough:
        out = rough_edges(out, rough, seed=seed)
    if shadow:
        out = drop_shadow(out, dx=dx, dy=dy, alpha=shadow_alpha)
    return out


def layer_like(img: Image.Image) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    return lay, ImageDraw.Draw(lay)


def rrect(d: ImageDraw.ImageDraw, box: tuple[float, float, float, float], r: float, fill, outline=None, width: int = 0) -> None:
    x0, y0, x1, y1 = box
    d.rounded_rectangle((S(x0), S(y0), S(x1), S(y1)), radius=S(r), fill=fill, outline=outline, width=S(width) if width else 0)


def ellipse(d: ImageDraw.ImageDraw, cx: float, cy: float, rx: float, ry: float, fill, outline=None, width: int = 0) -> None:
    d.ellipse((S(cx - rx), S(cy - ry), S(cx + rx), S(cy + ry)), fill=fill, outline=outline, width=S(width) if width else 0)


def line(d: ImageDraw.ImageDraw, pts, fill, width: float) -> None:
    d.line([(S(x), S(y)) for x, y in pts], fill=fill, width=max(1, S(width)), joint="curve")


def poly(d: ImageDraw.ImageDraw, pts, fill, outline=None) -> None:
    d.polygon([(S(x), S(y)) for x, y in pts], fill=fill, outline=outline)


def rot(img: Image.Image, angle: float) -> Image.Image:
    return img.rotate(angle, resample=Image.BICUBIC, expand=False)


def blur(img: Image.Image, r: float) -> Image.Image:
    return img.filter(ImageFilter.GaussianBlur(S(r)))


# ---- shared motifs -------------------------------------------------------------
def daisy(img: Image.Image, cx: float, cy: float, r: float, petals: int = 9, seed: int = 0, shadow: bool = True) -> None:
    rnd = random.Random(seed)
    lay, d = layer_like(img)
    for i in range(petals):
        a = 2 * math.pi * i / petals + rnd.uniform(-0.12, 0.12)
        plen = r * rnd.uniform(0.9, 1.05)
        pw = r * 0.42
        px, py = cx + math.cos(a) * plen * 0.55, cy + math.sin(a) * plen * 0.55
        petal = Image.new("RGBA", img.size, (0, 0, 0, 0))
        pd = ImageDraw.Draw(petal)
        ellipse(pd, px, py, plen * 0.5, pw, rgba(mix("white", "cream", 0.5)))
        # rotate petal about its own centre
        petal = petal.rotate(-math.degrees(a), center=(S(px), S(py)), resample=Image.BICUBIC)
        lay.alpha_composite(petal)
    d = ImageDraw.Draw(lay)
    ellipse(d, cx, cy, r * 0.36, r * 0.36, rgba("honey"))
    ellipse(d, cx - r * 0.08, cy - r * 0.08, r * 0.2, r * 0.2, rgba(shade("honey", 1.25)))
    lay = grain(lay, 0.08)
    if shadow:
        lay = drop_shadow(lay, dx=r * 0.15, dy=r * 0.2, blur=r * 0.15, alpha=0.28)
    img.alpha_composite(lay)


def lavender_sprig(img: Image.Image, x0: float, y0: float, x1: float, y1: float, size: float = 4.0, seed: int = 0, shadow: bool = True) -> None:
    rnd = random.Random(seed)
    lay, d = layer_like(img)
    line(d, [(x0, y0), (x1, y1)], rgba(mix("moss", "sage", 0.4)), size * 0.5)
    n = 7
    for i in range(n):
        t = 0.35 + 0.65 * i / (n - 1)
        px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        rr = size * (1.0 - 0.45 * i / n) * rnd.uniform(0.9, 1.1)
        nx, ny = -(y1 - y0), (x1 - x0)
        ln = math.hypot(nx, ny) or 1
        nx, ny = nx / ln * rr * 0.8, ny / ln * rr * 0.8
        for sgn in (-1, 1):
            c = "violet" if (i + sgn) % 2 else "lavender"
            ellipse(d, px + nx * sgn, py + ny * sgn, rr, rr * 0.8, rgba(c))
    ellipse(d, x1, y1, size * 0.6, size * 0.6, rgba("lavender"))
    lay = grain(lay, 0.08)
    if shadow:
        lay = drop_shadow(lay, dx=size * 0.3, dy=size * 0.4, blur=size * 0.3, alpha=0.25)
    img.alpha_composite(lay)


def bow(img: Image.Image, cx: float, cy: float, s: float, color: str = "coral") -> None:
    lay, d = layer_like(img)
    ellipse(d, cx - s * 0.9, cy, s * 0.9, s * 0.55, rgba(color))
    ellipse(d, cx + s * 0.9, cy, s * 0.9, s * 0.55, rgba(color))
    line(d, [(cx, cy + s * 0.2), (cx - s * 0.7, cy + s * 1.6)], rgba(color), s * 0.4)
    line(d, [(cx, cy + s * 0.2), (cx + s * 0.6, cy + s * 1.5)], rgba(color), s * 0.4)
    ellipse(d, cx, cy, s * 0.4, s * 0.4, rgba(shade(color, 0.8)))
    img.alpha_composite(grain(lay, 0.08))


def wood_planks(d: ImageDraw.ImageDraw, box, n: int, color: str, horizontal: bool = True) -> None:
    x0, y0, x1, y1 = box
    for i in range(1, n):
        if horizontal:
            y = y0 + (y1 - y0) * i / n
            line(d, [(x0 + 2, y), (x1 - 2, y)], rgba(color, 110), 1.2)
        else:
            x = x0 + (x1 - x0) * i / n
            line(d, [(x, y0 + 2), (x, y1 - 2)], rgba(color, 110), 1.2)


# ---- 1. ground -------------------------------------------------------------------
def grass_base(size: int = 128, seed: int = 7) -> Image.Image:
    rnd = random.Random(seed)
    img = canvas(size)
    d = ImageDraw.Draw(img)
    base = mix("sage", "moss", 0.38)
    d.rectangle((0, 0, img.width, img.height), fill=rgba(base))
    blobs = Image.new("RGBA", (img.width * 3, img.height * 3), (0, 0, 0, 0))
    bd = ImageDraw.Draw(blobs)
    for _ in range(90):
        cx, cy = rnd.uniform(0, size), rnd.uniform(0, size)
        rx, ry = rnd.uniform(5, 14), rnd.uniform(4, 10)
        t = rnd.uniform(-0.3, 0.3)
        c = mix(base, "sage", t * 1.3) if t > 0 else mix(base, "moss", -t * 0.8)
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                ellipse(bd, cx + ox + size, cy + oy + size, rx, ry, rgba(c, 95))
    blobs = blur(blobs, 3)
    img.alpha_composite(blobs.crop((img.width, img.height, img.width * 2, img.height * 2)))
    # faint blade strokes everywhere (wrapped)
    strokes = Image.new("RGBA", (img.width * 3, img.height * 3), (0, 0, 0, 0))
    sd = ImageDraw.Draw(strokes)
    for _ in range(70):
        x, y = rnd.uniform(0, size), rnd.uniform(0, size)
        ln = rnd.uniform(4, 9)
        a = rnd.uniform(-0.5, 0.5) - math.pi / 2
        c = mix(base, "moss", 0.5) if rnd.random() < 0.6 else mix(base, "sage", 0.7)
        for ox in (-size, 0, size):
            for oy in (-size, 0, size):
                line(sd, [(x + ox + size, y + oy + size), (x + ox + size + math.cos(a) * ln, y + oy + size + math.sin(a) * ln)], rgba(c, 120), 1.3)
    img.alpha_composite(strokes.crop((img.width, img.height, img.width * 2, img.height * 2)))
    return grain(img, 0.14, sigma=35)


def grass_variants() -> None:
    base = grass_base()
    save(base, "ground_grass_0.png")

    v1 = base.copy()
    d = ImageDraw.Draw(v1)
    # clover tuft
    for (cx, cy) in ((44, 70), (52, 62), (56, 74)):
        ellipse(d, cx, cy, 5.5, 5, rgba(mix("moss", "sage", 0.6)))
        ellipse(d, cx - 1.5, cy - 1.5, 2.5, 2.2, rgba(mix("sage", "cream", 0.25), 150))
    for (x, y, ln) in ((80, 48, 11), (86, 50, 9), (92, 46, 12)):
        line(d, [(x, y + ln), (x + 2, y)], rgba("moss"), 1.6)
    save(grain(v1, 0.05), "ground_grass_1.png")

    v2 = base.copy()
    d = ImageDraw.Draw(v2)
    rnd = random.Random(3)
    for (cx, cy, c) in ((36, 40, "pink"), (84, 86, "cream"), (96, 34, "coral"), (30, 92, "pink")):
        line(d, [(cx, cy + 9), (cx + 1, cy + 2)], rgba("moss"), 1.5)
        for i in range(5):
            a = 2 * math.pi * i / 5 + rnd.uniform(-0.2, 0.2)
            ellipse(d, cx + math.cos(a) * 2.6, cy + math.sin(a) * 2.6, 2.2, 1.7, rgba(c))
        ellipse(d, cx, cy, 1.3, 1.3, rgba("honey"))
    save(grain(v2, 0.05), "ground_grass_2.png")

    v3 = base.copy()
    stone = canvas(128)
    sd = ImageDraw.Draw(stone)
    ellipse(sd, 70, 76, 11, 8, rgba("grey_sage"))
    ellipse(sd, 66, 73, 5, 3, rgba(shade("grey_sage", 1.2), 170))
    stone = painted(stone, rough=1.2, shadow_alpha=0.25, dx=3, dy=4)
    v3.alpha_composite(stone)
    save(v3, "ground_grass_3.png")

    # locked plot: darker, wilder
    lk = grass_base(seed=11)
    dark = Image.new("RGBA", lk.size, rgba(shade("moss", 0.75), 70))
    lk.alpha_composite(dark)
    d = ImageDraw.Draw(lk)
    rnd = random.Random(5)
    for _ in range(30):
        x, y = rnd.uniform(4, 124), rnd.uniform(10, 124)
        ln = rnd.uniform(9, 16)
        a = -math.pi / 2 + rnd.uniform(-0.6, 0.6)
        line(d, [(x, y), (x + math.cos(a) * ln, y + math.sin(a) * ln)], rgba(shade("moss", 0.8), 170), 2)
    # A few wild seed heads instead of a per-tile border (a border would read as a grid).
    for (x, y) in ((30, 40), (88, 70), (58, 100)):
        line(d, [(x, y + 14), (x + 2, y)], rgba(shade("moss", 0.7)), 2)
        ellipse(d, x + 2, y - 2, 3.5, 2.5, rgba("kraft", 210))
    save(lk, "ground_locked.png")


def hedge_tiles() -> None:
    base = grass_base()
    size = 128

    def foliage(region, wrap_x: bool, wrap_y: bool, seed: int) -> Image.Image:
        rnd = random.Random(seed)
        big = Image.new("RGBA", (base.width * 3, base.height * 3), (0, 0, 0, 0))
        d = ImageDraw.Draw(big)
        pts = []
        for _ in range(170):
            x, y = rnd.uniform(0, size), rnd.uniform(0, size)
            if not region(x, y):
                continue
            r = rnd.uniform(7, 13)
            pts.append((x, y, r))
        pts.sort(key=lambda p: p[1] + p[0] * 0.3)
        for (x, y, r) in pts:
            c = mix("moss", "sage", rnd.uniform(0.0, 0.45))
            for ox in ((-size, 0, size) if wrap_x else (0,)):
                for oy in ((-size, 0, size) if wrap_y else (0,)):
                    ellipse(d, x + ox + size, y + oy + size, r, r * 0.9, rgba(c))
                    ellipse(d, x + ox + size - r * 0.3, y + oy + size - r * 0.3, r * 0.45, r * 0.35, rgba(mix("sage", "cream", 0.2), 120))
        lay = big.crop((base.width, base.height, base.width * 2, base.height * 2))
        lay = grain(lay, 0.12)
        return drop_shadow(lay, dx=4, dy=6, blur=4, alpha=0.32)

    regions = {
        "n": (lambda x, y: y < 70, True, False),
        "s": (lambda x, y: y > 58, True, False),
        "w": (lambda x, y: x < 70, False, True),
        "e": (lambda x, y: x > 58, False, True),
        "nw": (lambda x, y: y < 70 or x < 70, False, False),
        "ne": (lambda x, y: y < 70 or x > 58, False, False),
        "sw": (lambda x, y: y > 58 or x < 70, False, False),
        "se": (lambda x, y: y > 58 or x > 58, False, False),
    }
    for name, (fn, wx, wy) in regions.items():
        img = base.copy()
        img.alpha_composite(foliage(fn, wx, wy, seed=hash(name) % 1000))
        save(img, f"edge_hedge_{name}.png")


# ---- 3. belts ------------------------------------------------------------------
BELT_W = 0.62


def belt_straight(frame: int) -> Image.Image:
    img = canvas(128)
    half = 128 * BELT_W / 2
    y0, y1 = 64 - half, 64 + half
    band, d = layer_like(img)
    d.rectangle((0, S(y0), img.width, S(y1)), fill=rgba("canvas"))
    band = grain(band, 0.14)
    bd = ImageDraw.Draw(band)
    # rails
    bd.rectangle((0, S(y0), img.width, S(y0 + 7)), fill=rgba("wood_dark"))
    bd.rectangle((0, S(y1 - 7), img.width, S(y1)), fill=rgba("wood_dark"))
    bd.rectangle((0, S(y0 + 1.5), img.width, S(y0 + 4)), fill=rgba("wood_light", 160))
    for x in range(8, 128, 16):
        ellipse(bd, x, y0 + 3.5, 2.2, 2.2, rgba("honey"))
        ellipse(bd, x, y1 - 3.5, 2.2, 2.2, rgba("honey"))
    # inner shading toward rails
    bd.rectangle((0, S(y0 + 7), img.width, S(y0 + 10)), fill=rgba("canvas_dark", 120))
    bd.rectangle((0, S(y1 - 10), img.width, S(y1 - 7)), fill=rgba("canvas_dark", 120))
    # chevrons
    spacing = 32
    offset = frame * spacing / 8
    ch, cd = layer_like(img)
    for x in range(-spacing, 128 + spacing, spacing):
        cx = x + offset
        pts = [(cx - 7, 64 - 13), (cx + 1, 64 - 13), (cx + 9, 64), (cx + 1, 64 + 13), (cx - 7, 64 + 13), (cx + 1, 64)]
        poly(cd, pts, rgba("moss", 150))
    band.alpha_composite(ch)
    sh = drop_shadow(band, dx=0, dy=3, blur=2.5, alpha=0.22)
    img.alpha_composite(sh)
    return img


def belt_corner(frame: int) -> Image.Image:
    """Enter from west, exit south (clockwise). Arc centred on the tile's SW corner."""
    img = canvas(128)
    cx, cy = 0.0, 128.0
    r_mid = 64.0
    half = 128 * BELT_W / 2
    band, d = layer_like(img)
    d.pieslice((S(cx - r_mid - half), S(cy - r_mid - half), S(cx + r_mid + half), S(cy + r_mid + half)), 270, 360, fill=rgba("canvas"))
    d.pieslice((S(cx - r_mid + half), S(cy - r_mid + half), S(cx + r_mid - half), S(cy + r_mid - half)), 270, 360, fill=(0, 0, 0, 0))
    hole = Image.new("L", img.size, 0)
    hd = ImageDraw.Draw(hole)
    hd.pieslice((S(cx - r_mid + half), S(cy - r_mid + half), S(cx + r_mid - half), S(cy + r_mid - half)), 270, 360, fill=255)
    a = band.getchannel("A")
    a = ImageChops.subtract(a, hole)
    band.putalpha(a)
    band = grain(band, 0.14)
    bd = ImageDraw.Draw(band)
    for rr, inner in ((r_mid + half, False), (r_mid - half, True)):
        rail_r0, rail_r1 = (rr - 7, rr) if not inner else (rr, rr + 7)
        bd.arc((S(cx - rail_r1), S(cy - rail_r1), S(cx + rail_r1), S(cy + rail_r1)), 270, 360, fill=rgba("wood_dark"), width=S(7))
        _ = rail_r0
    for rr in (r_mid + half - 3.5, r_mid - half + 3.5):
        n = 8 if rr > r_mid else 3
        for i in range(n):
            ang = math.radians(270 + 90 * (i + 0.5) / n)
            ellipse(bd, cx + math.cos(ang) * rr, cy + math.sin(ang) * rr, 2.2, 2.2, rgba("honey"))
    # chevrons along the arc
    ch, cd = layer_like(img)
    n_ch = 3
    for i in range(-1, n_ch + 1):
        t = (i + frame / 8) / n_ch
        ang = math.radians(270 + 90 * t)
        px, py = cx + math.cos(ang) * r_mid, cy + math.sin(ang) * r_mid
        chev = Image.new("RGBA", img.size, (0, 0, 0, 0))
        chd = ImageDraw.Draw(chev)
        pts = [(px - 7, py - 13), (px + 1, py - 13), (px + 9, py), (px + 1, py + 13), (px - 7, py + 13), (px + 1, py)]
        poly(chd, pts, rgba("moss", 150))
        chev = chev.rotate(-(90 * t), center=(S(px), S(py)), resample=Image.BICUBIC)
        ch.alpha_composite(chev)
    ch.putalpha(ImageChops.multiply(ch.getchannel("A"), band.getchannel("A")))
    band.alpha_composite(ch)
    img.alpha_composite(drop_shadow(band, dx=0, dy=3, blur=2.5, alpha=0.22))
    return img


def belts() -> None:
    for f in range(8):
        save(belt_straight(f), f"belt_straight_{f}.png")
        cw = belt_corner(f)
        save(cw, f"belt_corner_cw_{f}.png")
        save(ImageOps.flip(cw), f"belt_corner_ccw_{f}.png")
    end = canvas(128)
    lay, d = layer_like(end)
    half = 128 * BELT_W / 2
    rrect(d, (116, 64 - half - 2, 128, 64 + half + 2), 4, rgba("wood_dark"))
    rrect(d, (118, 64 - half + 1, 125, 64 + half - 1), 3, rgba("wood", 200))
    end.alpha_composite(painted(lay, rough=1.0, shadow_alpha=0.3, dx=2, dy=3))
    save(end, "belt_end.png")


# ---- 2. beds -------------------------------------------------------------------
def bed(flower: str, state: str) -> Image.Image:
    img = canvas(144)
    o = 8  # tile offset inside the 144 canvas
    box = (o + 8, o + 8, o + 120, o + 120)
    body, d = layer_like(img)
    wood = "wood" if flower == "daisy" else mix("wood", "grey_sage", 0.45)
    rrect(d, box, 9, rgba(wood))
    wood_planks(d, box, 4, shade(wood, 0.78), horizontal=True)
    # chute on the east side (facing e)
    rrect(d, (o + 118, o + 44, o + 128, o + 84), 3, rgba(shade(wood, 0.85)))
    body = painted(body, rough=1.4, shadow_alpha=0.32, seed=3)
    img.alpha_composite(body)
    soil, sd = layer_like(img)
    rrect(sd, (o + 18, o + 18, o + 110, o + 110), 6, rgba("soil"))
    soil = grain(soil, 0.2, sigma=50)
    sd = ImageDraw.Draw(soil)
    rnd = random.Random(2)
    for _ in range(14):
        ellipse(sd, rnd.uniform(o + 24, o + 104), rnd.uniform(o + 24, o + 104), rnd.uniform(2, 4), rnd.uniform(1.5, 3), rgba("soil_light", 120))
    # inner shadow from the box rim
    rim = Image.new("RGBA", img.size, (0, 0, 0, 0))
    rd = ImageDraw.Draw(rim)
    rrect(rd, (o + 18, o + 18, o + 110, o + 110), 6, rgba("ink", 110))
    rrect(rd, (o + 22, o + 22, o + 112, o + 112), 6, (0, 0, 0, 0))
    rim = blur(rim, 2)
    rim.putalpha(ImageChops.multiply(rim.getchannel("A"), soil.getchannel("A")))
    soil.alpha_composite(rim)
    img.alpha_composite(soil)

    spots = [(o + 40, o + 40), (o + 86, o + 44), (o + 62, o + 66), (o + 40, o + 90), (o + 88, o + 88)]
    if flower == "lavender":
        spots = [(o + 36, o + 44), (o + 60, o + 36), (o + 88, o + 46), (o + 44, o + 86), (o + 70, o + 92), (o + 92, o + 84)]
    d = ImageDraw.Draw(img)
    if state == "empty":
        for (x, y) in spots:
            ellipse(d, x, y, 5, 3.5, rgba(shade("soil", 0.8)))
    elif state == "grow0":
        for i, (x, y) in enumerate(spots):
            line(d, [(x, y + 4), (x - 4, y - 5)], rgba("sage"), 2.2)
            line(d, [(x, y + 4), (x + 4, y - 5)], rgba(mix("sage", "moss", 0.4)), 2.2)
            ellipse(d, x - 4, y - 6, 2.5, 1.8, rgba("sage"))
            ellipse(d, x + 4, y - 6, 2.5, 1.8, rgba("sage"))
    elif state == "grow1":
        for i, (x, y) in enumerate(spots):
            line(d, [(x, y + 6), (x, y - 6)], rgba(mix("sage", "moss", 0.5)), 2.4)
            line(d, [(x, y + 2), (x - 6, y - 2)], rgba("sage"), 2)
            line(d, [(x, y + 1), (x + 6, y - 4)], rgba("sage"), 2)
            c = "cream" if flower == "daisy" else "lavender"
            ellipse(d, x, y - 8, 4, 5, rgba(mix(c, "sage", 0.35)))
            ellipse(d, x - 1, y - 9, 2, 2.5, rgba(c, 190))
    else:  # ready
        if flower == "daisy":
            for i, (x, y) in enumerate(spots):
                daisy(img, x, y - 2, 11, seed=i)
        else:
            for i, (x, y) in enumerate(spots):
                lavender_sprig(img, x - 6, y + 14, x + 5, y - 14, size=4.2, seed=i)
    return img


def beds() -> None:
    for flower in ("daisy", "lavender"):
        for state in ("empty", "grow0", "grow1", "ready"):
            save(bed(flower, state), f"bed_{flower}_e_{state}.png")


# ---- 4. machines ------------------------------------------------------------------
def tray(img: Image.Image, o: int = 8) -> None:
    lay, d = layer_like(img)
    rrect(d, (o + 116, o + 40, o + 128, o + 88), 3, rgba("wood_dark"))
    rrect(d, (o + 118, o + 43, o + 127, o + 85), 2, rgba("wood", 210))
    img.alpha_composite(painted(lay, rough=1.0, shadow_alpha=0.3, dx=2, dy=3, seed=9))


def item_sprite(kind: str) -> Image.Image:
    """Return a 64-canvas item at SS scale (used on trays and as the item files)."""
    img = canvas(64)
    d = ImageDraw.Draw(img)
    if kind == "daisy":
        daisy(img, 32, 32, 20, seed=1)
    elif kind == "lavender":
        lavender_sprig(img, 20, 54, 44, 12, size=5.5, seed=2)
    elif kind == "daisy_bundle":
        stems, sd = layer_like(img)
        for (x0, y0, x1, y1) in ((24, 34, 30, 58), (32, 34, 32, 58), (40, 34, 34, 58)):
            line(sd, [(x0, y0), (x1, y1)], rgba(mix("moss", "sage", 0.4)), 3)
        img.alpha_composite(drop_shadow(stems, 2, 2, 1.5, 0.25))
        daisy(img, 20, 26, 12, petals=8, seed=3)
        daisy(img, 44, 26, 12, petals=8, seed=4)
        daisy(img, 32, 16, 13, petals=8, seed=5)
        bow(img, 32, 46, 5)
    elif kind == "lavender_sachet":
        pouch, pd = layer_like(img)
        ellipse(pd, 32, 40, 17, 18, rgba("cream"))
        poly(pd, [(20, 26), (44, 26), (40, 14), (24, 14)], rgba("cream"))
        pouch = painted(pouch, rough=1.2, shadow_alpha=0.3, dx=2, dy=3, seed=4)
        img.alpha_composite(pouch)
        d = ImageDraw.Draw(img)
        line(d, [(21, 27), (43, 27)], rgba("lavender"), 3.5)
        line(d, [(28, 27), (24, 20)], rgba("lavender"), 2.5)
        line(d, [(36, 27), (40, 20)], rgba("lavender"), 2.5)
        ellipse(d, 32, 27, 2.6, 2.6, rgba("violet"))
        lavender_sprig(img, 36, 24, 46, 8, size=3.2, seed=6, shadow=False)
    elif kind == "mixed_bouquet":
        cone, cd = layer_like(img)
        poly(cd, [(32, 60), (14, 30), (50, 30)], rgba("kraft"))
        poly(cd, [(14, 30), (50, 30), (44, 24), (20, 24)], rgba(shade("kraft", 1.1)))
        cone = painted(cone, rough=1.1, shadow_alpha=0.3, dx=2, dy=3, seed=5)
        stems, sd = layer_like(img)
        for (x0, x1) in ((22, 20), (32, 32), (42, 44)):
            line(sd, [(x0, 36), (x1, 18)], rgba(mix("moss", "sage", 0.4)), 2.5)
        img.alpha_composite(stems)
        lavender_sprig(img, 36, 30, 50, 6, size=3.6, seed=7)
        lavender_sprig(img, 28, 30, 14, 8, size=3.6, seed=8)
        daisy(img, 22, 16, 9, petals=8, seed=9)
        daisy(img, 42, 16, 9, petals=8, seed=10)
        daisy(img, 32, 10, 9.5, petals=8, seed=11)
        img.alpha_composite(cone)
        d = ImageDraw.Draw(img)
        line(d, [(18, 38), (46, 38)], rgba("pink"), 3.2)
        bow(img, 32, 40, 3.6, color="pink")
    return img


def place_item(img: Image.Image, kind: str, cx: float, cy: float, scale: float = 0.7) -> None:
    it = item_sprite(kind)
    w = round(it.width * scale)
    it = it.resize((w, w), Image.LANCZOS)
    img.alpha_composite(it, (S(cx) - w // 2, S(cy) - w // 2))


def table_body(img: Image.Image, color: str, o: int = 8, shape: str = "rect", planks: bool = True) -> None:
    lay, d = layer_like(img)
    if shape == "round":
        ellipse(d, o + 62, o + 64, 52, 50, rgba(color))
    else:
        rrect(d, (o + 10, o + 12, o + 114, o + 116), 12, rgba(color))
        if planks:
            wood_planks(d, (o + 10, o + 12, o + 114, o + 116), 5, shade(color, 0.8), horizontal=False)
    img.alpha_composite(painted(lay, rough=1.5, shadow_alpha=0.34, seed=7))


def machine_bundling(state: str) -> Image.Image:
    img = canvas(144)
    o = 8
    tray(img, o)
    table_body(img, "wood", o)
    frame = int(state[-1]) if state.startswith("work") else -1
    # twine spool
    spool, sd = layer_like(img)
    ellipse(sd, o + 48, o + 60, 24, 24, rgba("coral"))
    ellipse(sd, o + 48, o + 60, 17, 17, rgba(shade("coral", 1.12)))
    ang0 = (frame if frame >= 0 else 0) * 22.5
    for k in range(4):
        a = math.radians(ang0 + k * 45)
        line(sd, [(o + 48 + math.cos(a) * 17, o + 60 + math.sin(a) * 17), (o + 48 - math.cos(a) * 17, o + 60 - math.sin(a) * 17)], rgba(shade("coral", 0.85), 170), 1.6)
    ellipse(sd, o + 48, o + 60, 5, 5, rgba("cream"))
    img.alpha_composite(painted(spool, rough=1.0, shadow_alpha=0.28, dx=3, dy=4, seed=8))
    d = ImageDraw.Draw(img)
    # twine running to the work spot
    sway = math.sin((frame if frame >= 0 else 0) / 4 * math.pi * 2) * 4
    line(d, [(o + 70, o + 56), (o + 86 + sway, o + 40), (o + 96, o + 52)], rgba(shade("coral", 0.9)), 1.8)
    # snips
    line(d, [(o + 78, o + 96), (o + 104, o + 78)], rgba("ink"), 2.4)
    line(d, [(o + 80, o + 80), (o + 104, o + 98)], rgba("ink"), 2.4)
    ellipse(d, o + 78, o + 97, 4, 4, rgba("honey"), outline=rgba("ink"), width=1)
    ellipse(d, o + 79, o + 79, 4, 4, rgba("honey"), outline=rgba("ink"), width=1)
    if frame >= 0:
        # a loose daisy being tied
        daisy(img, o + 94, o + 42, 9, petals=8, seed=20)
        if frame >= 2:
            daisy(img, o + 84, o + 30, 8, petals=8, seed=21)
    if state == "ready":
        place_item(img, "daisy_bundle", o + 122, o + 64, 0.62)
    return img


def machine_drying(state: str) -> Image.Image:
    img = canvas(144)
    o = 8
    tray(img, o)
    table_body(img, mix("grey_sage", "wood", 0.3), o)
    frame = int(state[-1]) if state.startswith("work") else -1
    d = ImageDraw.Draw(img)
    # rack posts and bar
    line(d, [(o + 22, o + 30), (o + 22, o + 100)], rgba("wood_dark"), 4)
    line(d, [(o + 102, o + 30), (o + 102, o + 100)], rgba("wood_dark"), 4)
    line(d, [(o + 18, o + 34), (o + 106, o + 34)], rgba("ink"), 3)
    # hanging bunches (stems up)
    for i, x in enumerate((o + 40, o + 62, o + 84)):
        sway = math.sin(((frame if frame >= 0 else 0) / 4 + i * 0.3) * math.pi * 2) * 3 if frame >= 0 else 0
        line(d, [(x, o + 34), (x + sway, o + 48)], rgba(mix("moss", "sage", 0.4)), 2.2)
        lavender_sprig(img, x + sway * 0.5, o + 46, x + sway, o + 76, size=4.4, seed=30 + i)
    # muslin pouch on the bench
    pouch, pd = layer_like(img)
    ellipse(pd, o + 36, o + 104, 11, 9, rgba("cream"))
    img.alpha_composite(painted(pouch, rough=1.0, shadow_alpha=0.25, dx=2, dy=3, seed=31))
    if frame >= 0:
        d = ImageDraw.Draw(img)
        rnd = random.Random(frame)
        for _ in range(6):
            ellipse(d, rnd.uniform(o + 30, o + 100), rnd.uniform(o + 40, o + 90), 1.3, 1.3, rgba("cream", 150))
    if state == "ready":
        place_item(img, "lavender_sachet", o + 122, o + 64, 0.62)
    return img


def machine_arrangement(state: str) -> Image.Image:
    img = canvas(144)
    o = 8
    tray(img, o)
    table_body(img, mix("cream", "wood_light", 0.2), o, shape="round")
    cloth, cd = layer_like(img)
    ellipse(cd, o + 62, o + 64, 42, 40, rgba("lavender"))
    img.alpha_composite(painted(cloth, rough=1.6, shadow=False, seed=12))
    frame = int(state[-1]) if state.startswith("work") else -1
    # kraft roll
    roll, rd = layer_like(img)
    rrect(rd, (o + 30, o + 86, o + 72, o + 100), 6, rgba("kraft"))
    ellipse(rd, o + 72, o + 93, 7, 7, rgba(shade("kraft", 0.85)))
    img.alpha_composite(painted(roll, rough=1.0, shadow_alpha=0.28, dx=2, dy=3, seed=13))
    # vase
    vase, vd = layer_like(img)
    rrect(vd, (o + 52, o + 50, o + 76, o + 80), 7, rgba("honey"))
    img.alpha_composite(painted(vase, rough=1.0, shadow_alpha=0.3, dx=3, dy=4, seed=14))
    n_stems = 0 if frame < 0 else frame + 1
    if state == "idle":
        n_stems = 1
    if state == "ready":
        n_stems = 4
    d = ImageDraw.Draw(img)
    for i in range(n_stems):
        a = math.radians(-90 + (i - (n_stems - 1) / 2) * 22)
        x1, y1 = o + 64 + math.cos(a) * 26, o + 54 + math.sin(a) * 26
        line(d, [(o + 64, o + 56), (x1, y1)], rgba(mix("moss", "sage", 0.4)), 2.2)
        if i % 2 == 0:
            daisy(img, x1, y1, 7, petals=8, seed=40 + i)
        else:
            lavender_sprig(img, x1 - 2, y1 + 8, x1 + 2, y1 - 8, size=3, seed=40 + i)
    # scattered petals
    rnd = random.Random(3)
    for _ in range(5):
        ellipse(d, rnd.uniform(o + 30, o + 96), rnd.uniform(o + 36, o + 92), 2.6, 1.6, rgba("pink", 220))
    if state == "ready":
        place_item(img, "mixed_bouquet", o + 122, o + 64, 0.62)
    return img


def machine_packing(state: str) -> Image.Image:
    img = canvas(144)
    o = 8
    frame = int(state[-1]) if state.startswith("receive") else -1
    crate, cd = layer_like(img)
    rrect(cd, (o + 10, o + 14, o + 118, o + 118), 8, rgba("wood_dark"))
    wood_planks(cd, (o + 10, o + 14, o + 118, o + 118), 4, shade("wood_dark", 0.8), horizontal=True)
    img.alpha_composite(painted(crate, rough=1.5, shadow_alpha=0.34, seed=15))
    paper, pd = layer_like(img)
    rrect(pd, (o + 22, o + 26, o + 106, o + 106), 6, rgba("cream"))
    img.alpha_composite(painted(paper, rough=2.0, shadow=False, seed=16))
    # stack of flat boxes
    boxes, bd = layer_like(img)
    for i, c in enumerate(("kraft", shade("kraft", 1.08), shade("kraft", 1.16))):
        rrect(bd, (o + 32 + i * 3, o + 70 - i * 6, o + 78 + i * 3, o + 96 - i * 6), 3, rgba(c))
    img.alpha_composite(painted(boxes, rough=1.0, shadow_alpha=0.25, dx=2, dy=3, seed=17))
    d = ImageDraw.Draw(img)
    # wax seal stamp
    ellipse(d, o + 92, o + 86, 9, 9, rgba("coral"))
    ellipse(d, o + 92, o + 86, 5, 5, rgba(shade("coral", 0.85)))
    line(d, [(o + 92, o + 77), (o + 92, o + 64)], rgba("wood_dark"), 4)
    # tag with string (swings on receive)
    swing = math.sin((frame / 4) * math.pi * 2) * 6 if frame >= 0 else 0
    line(d, [(o + 40, o + 26), (o + 44 + swing, o + 44)], rgba("ink"), 1.5)
    tag, td = layer_like(img)
    rrect(td, (o + 36 + swing, o + 42, o + 56 + swing, o + 56), 2, rgba("cream"))
    img.alpha_composite(painted(tag, rough=0.8, shadow_alpha=0.3, dx=2, dy=3, seed=18))
    d = ImageDraw.Draw(img)
    line(d, [(o + 40 + swing, o + 49), (o + 52 + swing, o + 49)], rgba("coral"), 2)
    # lid flap (flutters)
    lift = (0, 6, 10, 5)[frame] if frame >= 0 else 0
    flap, fd = layer_like(img)
    rrect(fd, (o + 10, o + 8 - lift, o + 118, o + 22 - lift * 0.4), 5, rgba("wood"))
    img.alpha_composite(painted(flap, rough=1.3, shadow_alpha=0.3 + lift * 0.01, dx=3, dy=4 + lift * 0.5, seed=19))
    return img


def machines() -> None:
    for name, fn in (("bundling", machine_bundling), ("drying", machine_drying), ("arrangement", machine_arrangement)):
        for state in ("idle", "work0", "work1", "work2", "work3", "ready"):
            save(fn(state), f"machine_{name}_e_{state}.png")
    for state in ("idle", "receive0", "receive1", "receive2", "receive3"):
        save(machine_packing(state), f"machine_packing_{state}.png")


# ---- 5. items --------------------------------------------------------------------
def items() -> None:
    for kind in ("daisy", "lavender", "daisy_bundle", "lavender_sachet", "mixed_bouquet"):
        save(item_sprite(kind), f"item_{kind}.png")


# ---- 6. badges and tile overlays ----------------------------------------------------
def pennant(color: str) -> Image.Image:
    img = canvas(64)
    lay, d = layer_like(img)
    rrect(d, (10, 6, 54, 46), 12, rgba(color))
    poly(d, [(26, 44), (38, 44), (32, 56)], rgba(color))
    img.alpha_composite(painted(lay, rough=1.2, shadow_alpha=0.32, dx=2, dy=3, seed=21))
    return img


def badges() -> None:
    b = pennant("coral")
    d = ImageDraw.Draw(b)
    line(d, [(32, 14), (32, 30)], rgba("cream"), 6)
    ellipse(d, 32, 38, 3.5, 3.5, rgba("cream"))
    save(b, "badge_blocked.png")

    b = pennant("lavender")
    d = ImageDraw.Draw(b)
    for x in (22, 32, 42):
        ellipse(d, x, 27, 3.6, 3.6, rgba("cream"))
    save(b, "badge_waiting.png")

    b = pennant("honey")
    d = ImageDraw.Draw(b)
    line(d, [(20, 27), (29, 36), (45, 17)], rgba("cream"), 6)
    save(b, "badge_ready.png")

    b = pennant("coral")
    d = ImageDraw.Draw(b)
    line(d, [(22, 16), (42, 36)], rgba("cream"), 6)
    line(d, [(42, 16), (22, 36)], rgba("cream"), 6)
    save(b, "badge_wrong.png")

    def ring(color: str, name: str, hatch: bool = False) -> None:
        img = canvas(128)
        lay, d = layer_like(img)
        rrect(d, (5, 5, 123, 123), 14, None, outline=rgba(color, 245), width=7)
        for (x, y, sx, sy) in ((5, 5, 1, 1), (123, 5, -1, 1), (5, 123, 1, -1), (123, 123, -1, -1)):
            line(d, [(x + sx * 3, y + sy * 22), (x + sx * 3, y + sy * 3), (x + sx * 22, y + sy * 3)], rgba(color), 10)
        if hatch:
            for i in range(-128, 128, 24):
                line(d, [(i, 128), (i + 128, 0)], rgba(color, 70), 3)
            mask = Image.new("L", img.size, 0)
            ImageDraw.Draw(mask).rounded_rectangle((S(10), S(10), S(118), S(118)), radius=S(12), fill=255)
            a = lay.getchannel("A")
            # keep hatch only inside, ring everywhere
            ring_only, rd = layer_like(img)
            rrect(rd, (5, 5, 123, 123), 14, None, outline=rgba(color, 245), width=7)
            inside = ImageChops.multiply(a, mask)
            lay.putalpha(ImageChops.lighter(inside, ring_only.getchannel("A")))
        img.alpha_composite(drop_shadow(grain(lay, 0.08), 1, 1.5, 1.5, 0.25))
        save(img, name)

    ring("sage", "tile_valid.png")
    ring("coral", "tile_invalid.png", hatch=True)
    ring("honey", "tile_select.png")


# ---- 7. UI icons --------------------------------------------------------------------
def icon(name: str, draw_fn) -> None:
    img = canvas(96)
    lay, d = layer_like(img)
    draw_fn(d, lay)
    img.alpha_composite(painted(lay, rough=0.8, shadow_alpha=0.22, dx=2, dy=2, seed=22))
    save(img, f"ui_{name}.png")


def icons() -> None:
    ink = rgba("ink")

    def coin(d, lay):
        ellipse(d, 48, 48, 34, 34, rgba(shade("honey", 0.85)))
        ellipse(d, 46, 46, 28, 28, rgba("honey"))
        ellipse(d, 40, 40, 10, 10, rgba(shade("honey", 1.3), 150))
        for i in range(5):
            a = 2 * math.pi * i / 5 - math.pi / 2
            ellipse(d, 48 + math.cos(a) * 9, 50 + math.sin(a) * 9, 5, 3.5, rgba("cream", 200))
        ellipse(d, 48, 50, 3, 3, rgba(shade("honey", 0.8)))

    def order(d, lay):
        rrect(d, (20, 14, 76, 82), 6, rgba("cream"))
        for y in (32, 44, 56):
            line(d, [(30, y), (66, y)], rgba("ink", 140), 3)
        ellipse(d, 64, 70, 10, 10, rgba("pink"))
        ellipse(d, 64, 70, 5, 5, rgba("coral"))

    def pause(d, lay):
        rrect(d, (26, 20, 42, 76), 6, ink)
        rrect(d, (54, 20, 70, 76), 6, ink)

    def play(d, lay):
        poly(d, [(30, 18), (78, 48), (30, 78)], ink)

    def fast(d, lay):
        poly(d, [(14, 22), (48, 48), (14, 74)], ink)
        poly(d, [(50, 22), (84, 48), (50, 74)], ink)

    def rotate(d, lay):
        d.arc((S(20), S(20), S(76), S(76)), 300, 230, fill=ink, width=S(8))
        poly(d, [(70, 14), (84, 40), (56, 36)], ink)

    def remove(d, lay):
        rrect(d, (42, 10, 54, 50), 5, rgba("wood_dark"))
        poly(d, [(30, 48), (66, 48), (60, 86), (36, 86)], rgba("coral"))
        rrect(d, (30, 44, 66, 54), 4, rgba("grey_sage"))

    def undo(d, lay):
        d.arc((S(26), S(26), S(80), S(80)), 180, 60, fill=ink, width=S(8))
        poly(d, [(14, 44), (40, 22), (40, 56)], ink)

    def settings(d, lay):
        for i in range(7):
            a = 2 * math.pi * i / 7
            ellipse(d, 48 + math.cos(a) * 24, 48 + math.sin(a) * 24, 12, 12, ink)
        ellipse(d, 48, 48, 22, 22, ink)
        ellipse(d, 48, 48, 10, 10, rgba("cream"))

    def bell(d, lay, off=False):
        poly(d, [(48, 14), (72, 60), (24, 60)], ink)
        d.pieslice((S(24), S(16), S(72), S(64)), 180, 360, fill=ink)
        rrect(d, (20, 58, 76, 68), 4, ink)
        ellipse(d, 48, 76, 8, 6, ink)
        if off:
            line(d, [(16, 84), (82, 14)], rgba("coral"), 8)

    def note(d, lay, off=False):
        ellipse(d, 34, 70, 14, 10, ink)
        rrect(d, (44, 14, 52, 70), 3, ink)
        poly(d, [(44, 14), (76, 26), (76, 44), (52, 32)], ink)
        if off:
            line(d, [(16, 84), (82, 14)], rgba("coral"), 8)

    def helpi(d, lay):
        for i in range(6):
            a = 2 * math.pi * i / 6
            ellipse(d, 48 + math.cos(a) * 24, 48 + math.sin(a) * 24, 15, 15, rgba("pink"))
        ellipse(d, 48, 48, 24, 24, rgba("cream"))
        d.arc((S(36), S(30), S(60), S(54)), 190, 90, fill=ink, width=S(6))
        line(d, [(48, 52), (48, 60)], ink, 6)
        ellipse(d, 48, 68, 4, 4, ink)

    def basket(d, lay):
        poly(d, [(14, 40), (82, 40), (72, 82), (24, 82)], rgba("wood"))
        for y in (52, 64, 76):
            line(d, [(20, y), (76, y)], rgba("wood_dark", 170), 2.5)
        d.arc((S(28), S(10), S(68), S(50)), 180, 360, fill=rgba("wood_dark"), width=S(6))
        rrect(d, (12, 36, 84, 46), 4, rgba("wood_dark"))

    def expand(d, lay):
        for (dx, dy) in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
            line(d, [(48 + dx * 14, 48 + dy * 14), (48 + dx * 34, 48 + dy * 34)], ink, 7)
            poly(d, [(48 + dx * 38, 48 + dy * 38), (48 + dx * 38, 48 + dy * 20), (48 + dx * 20, 48 + dy * 38)], ink)
        line(d, [(48, 60), (48, 40)], rgba("moss"), 5)
        ellipse(d, 42, 40, 6, 4, rgba("sage"))
        ellipse(d, 54, 44, 6, 4, rgba("sage"))

    def check(d, lay):
        ellipse(d, 48, 48, 36, 36, rgba("sage"))
        line(d, [(28, 50), (42, 64), (70, 32)], rgba("cream"), 9)

    icon("coin", coin)
    icon("order", order)
    icon("pause", pause)
    icon("play", play)
    icon("fast", fast)
    icon("rotate", rotate)
    icon("remove", remove)
    icon("undo", undo)
    icon("settings", settings)
    icon("sound_on", lambda d, l: bell(d, l))
    icon("sound_off", lambda d, l: bell(d, l, True))
    icon("music_on", lambda d, l: note(d, l))
    icon("music_off", lambda d, l: note(d, l, True))
    icon("help", helpi)
    icon("basket", basket)
    icon("expand", expand)
    icon("check", check)


# ---- 8. decor ---------------------------------------------------------------------
def decor() -> None:
    img = canvas(64)
    lay, d = layer_like(img)
    ellipse(d, 24, 40, 14, 10, rgba("grey_sage"))
    ellipse(d, 44, 34, 10, 8, rgba(shade("grey_sage", 1.08)))
    ellipse(d, 20, 36, 6, 3.5, rgba(shade("grey_sage", 1.25), 150))
    img.alpha_composite(painted(lay, rough=1.2, shadow_alpha=0.28, dx=2, dy=3, seed=23))
    save(img, "decor_stone_0.png")

    img = canvas(64)
    d = ImageDraw.Draw(img)
    rnd = random.Random(4)
    for i in range(11):
        x = 18 + i * 2.8
        h = rnd.uniform(18, 30)
        lean = rnd.uniform(-8, 8)
        line(d, [(x, 54), (x + lean, 54 - h)], rgba(mix("moss", "sage", rnd.uniform(0.1, 0.6))), 2.4)
    save(drop_shadow(img, 1.5, 2, 1.5, 0.25), "decor_tuft_0.png")

    img = canvas(64)
    lay, d = layer_like(img)
    for (x, y, r) in ((24, 36, 13), (44, 42, 9)):
        rrect(d, (x - r * 0.35, y, x + r * 0.35, y + r * 1.3), 3, rgba("cream"))
        ellipse(d, x, y, r, r * 0.7, rgba(mix("cream", "honey", 0.4)))
        ellipse(d, x - r * 0.3, y - r * 0.2, r * 0.3, r * 0.2, rgba("cream", 200))
    img.alpha_composite(painted(lay, rough=1.0, shadow_alpha=0.3, dx=2, dy=3, seed=24))
    save(img, "decor_mushroom_0.png")

    img = canvas(64)
    d = ImageDraw.Draw(img)
    for (x, y, c) in ((20, 26, "pink"), (34, 18, "coral"), (46, 30, "pink")):
        line(d, [(x, 56), (x, y + 4)], rgba("moss"), 2)
        for i in range(5):
            a = 2 * math.pi * i / 5
            ellipse(d, x + math.cos(a) * 4.5, y + math.sin(a) * 4.5, 3.6, 2.8, rgba(c))
        ellipse(d, x, y, 2, 2, rgba("honey"))
    save(drop_shadow(grain(img, 0.08), 1.5, 2, 1.5, 0.25), "decor_wildflower_0.png")

    img = canvas(128)
    lay, d = layer_like(img)
    rrect(d, (34, 44, 96, 104), 14, rgba("honey"))
    rrect(d, (54, 30, 76, 50), 5, rgba(shade("honey", 0.9)))
    line(d, [(94, 70), (118, 40)], rgba(shade("honey", 0.9)), 9)
    ellipse(d, 118, 40, 9, 6, rgba(shade("honey", 0.85)))
    d.arc((S(14), S(50), S(60), S(96)), 90, 270, fill=rgba(shade("honey", 0.8)), width=S(7))
    img.alpha_composite(painted(lay, rough=1.4, shadow_alpha=0.32, seed=25))
    save(img, "decor_watering_can.png")

    img = canvas(128)
    lay, d = layer_like(img)
    pot = mix("coral", "wood", 0.5)
    poly(d, [(30, 60), (96, 60), (86, 112), (40, 112)], rgba(pot))
    rrect(d, (26, 52, 100, 66), 4, rgba(shade(pot, 1.08)))
    poly(d, [(44, 28), (84, 28), (80, 56), (48, 56)], rgba(shade(pot, 1.12)))
    rrect(d, (40, 22, 88, 34), 3, rgba(shade(pot, 1.18)))
    img.alpha_composite(painted(lay, rough=1.4, shadow_alpha=0.32, seed=26))
    save(img, "decor_terracotta.png")


# ---- 9. effects ---------------------------------------------------------------------
def effects() -> None:
    img = canvas(32)
    d = ImageDraw.Draw(img)
    poly(d, [(16, 2), (19, 13), (30, 16), (19, 19), (16, 30), (13, 19), (2, 16), (13, 13)], rgba("white"))
    img = blur(img, 0.6)
    save(img, "fx_sparkle.png")
    for name, c in (("daisy", "white"), ("pink", "pink"), ("lavender", "lavender")):
        img = canvas(32)
        d = ImageDraw.Draw(img)
        ellipse(d, 16, 16, 12, 6, rgba(c))
        save(grain(img, 0.08), f"fx_petal_{name}.png")
    img = canvas(128)
    d = ImageDraw.Draw(img)
    ellipse(d, 64, 64, 56, 56, None, outline=rgba("cream", 230), width=8)
    save(blur(img, 1.5), "fx_ring.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = [grass_variants, hedge_tiles, belts, beds, machines, items, badges, icons, decor, effects]
    only = sys.argv[1:]
    for job in jobs:
        if only and job.__name__ not in only:
            continue
        print(f"  {job.__name__}...", flush=True)
        job()
    n = len(list(OUT.glob("*.png")))
    print(f"wrote {n} files to {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
