#!/usr/bin/env python3
"""Turn the raw Higgsfield generations into game-ready assets.

Usage: python3 tools/process_assets.py <raw_dir>

- sprites/ui: trim transparent border, scale to target size, save WebP
- textures: resize + make seamlessly tileable
- font: slice glyph sheets into an atlas + JSON metrics
"""
import json
import os
import sys

import numpy as np
from PIL import Image

RAW = sys.argv[1]
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "assets")

# name -> (raw file, (max_w, max_h))
SPRITES = {
    "player_front": ("00_player_front", (200, 200)),
    "player_back": ("01_player_back", (200, 200)),
    "alien_grunt": ("02_alien_grunt", (220, 220)),
    "alien_brute": ("03_alien_brute", (300, 300)),
    "alien_crawler": ("04_alien_crawler", (200, 200)),
    "alien_spitter": ("05_alien_spitter", (220, 220)),
    "ufo": ("06_ufo", (360, 360)),
    "mothership": ("07_mothership", (620, 620)),
    "landed_ufo": ("08_landed_ufo", (440, 440)),
    "car_police": ("09_police", (300, 300)),
    "car_pickup": ("10_pickup", (300, 300)),
    "car_minivan": ("11_minivan", (300, 300)),
    "house_a": ("12_house_a", (520, 520)),
    "house_b": ("13_house_b", (480, 480)),
    "store": ("14_store", (440, 440)),
    "gas_station": ("15_gas", (500, 500)),
    "joshua_tree": ("16_joshua", (300, 300)),
    "palm": ("17_palm", (400, 400)),
    "rocks": ("18_rocks", (240, 240)),
    "shrub": ("19_shrub", (140, 140)),
    "water_tower": ("20_watertower", (420, 420)),
    "car_wreck": ("21_wreck", (300, 300)),
    "bin_mailbox": ("22_bin", (150, 150)),
    "crater": ("23_crater", (300, 300)),
    "pk_ammo": ("24_ammo", (140, 140)),
    "pk_medkit": ("25_medkit", (140, 140)),
    "pk_core": ("26_core", (140, 140)),
    "meteor": ("27_meteor", (260, 260)),
    "pk_grenades": ("47_grenades", (140, 140)),
    "house_c": ("48_house_c", (520, 520)),
    "car_sheriff": ("49_sheriff", (300, 300)),
    "streetlight": ("50_streetlight", (300, 300)),
    "hydrant": ("51_hydrant", (90, 90)),
    "cow": ("52_cow", (200, 200)),
    "sandbags": ("53_sandbags", (240, 240)),
    "trailer": ("54_trailer", (360, 360)),
    "pk_smg": ("55_smg", (140, 140)),
    "civ_dad": ("56_civ_dad", (200, 200)),
    "civ_curlers": ("57_civ_curlers", (200, 200)),
    "civ_tinfoil": ("58_civ_tinfoil", (200, 200)),
    "tumbleweed": ("59_tumbleweed", (120, 120)),
    "vulture": ("60_vulture", (220, 220)),
    "flamingo": ("61_flamingo", (90, 90)),
}

UI = {
    "logo": ("28_logo", (960, 960)),
    "icon_heart": ("31_i_heart", (128, 128)),
    "icon_ammo": ("32_i_ammo", (128, 128)),
    "icon_clock": ("33_i_clock", (128, 128)),
    "icon_skull": ("34_i_skull", (128, 128)),
    "btn_pause": ("36_b_pause", (160, 160)),
    "joy_base": ("37_joy_base", (320, 320)),
    "joy_knob": ("38_joy_knob", (180, 180)),
    "btn_wide": ("39_button", (640, 640)),
    "panel": ("40_panel", (640, 640)),
    "btn_grenade": ("46_b_grenade", (200, 200)),
    "icon_radio": ("63_i_radio", (128, 128)),
}

TEXTURES = {
    "sand": "41_t_sand",
    "grass": "42_t_grass",
    "asphalt": "43_t_asphalt",
    "concrete": "44_t_concrete",
    "dirt": "45_t_dirt",
}


def load(name):
    return Image.open(os.path.join(RAW, name + ".png")).convert("RGBA")


def trim(im, thresh=10, pad=2):
    a = np.array(im.split()[-1])
    ys, xs = np.where(a > thresh)
    if len(xs) == 0:
        return im
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, im.width)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, im.height)
    return im.crop((x0, y0, x1, y1))


def clean_alpha(im):
    """Zero RGB where alpha is 0 so WebP does not leak fringe colours."""
    arr = np.array(im)
    arr[arr[..., 3] < 4] = 0
    return Image.fromarray(arr, "RGBA")


def fit(im, box):
    s = min(box[0] / im.width, box[1] / im.height, 1.0)
    if s < 1.0:
        im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
    return im


def save_webp(im, path, q=88):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", quality=q, method=6)


def fix_joy_base(im):
    # The generated ring is missing its left arrow: mirror the right half.
    w, h = im.size
    right = im.crop((w // 2, 0, w, h)).transpose(Image.FLIP_LEFT_RIGHT)
    im = im.copy()
    im.paste(right, (0, 0))
    return im


def seamless(im, size=512):
    im = im.convert("RGB").resize((size, size), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    rolled = np.roll(np.roll(a, size // 2, axis=0), size // 2, axis=1)
    t = np.linspace(0, 1, size, dtype=np.float32)
    f = 1 - np.abs(2 * t - 1)  # 0 at edges, 1 at centre
    f = np.clip(f * 1.6, 0, 1)
    f = f * f * (3 - 2 * f)
    w = np.minimum(f[:, None], f[None, :])[..., None]
    out = a * w + rolled * (1 - w)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def runs(profile, min_gap, thresh=0):
    """Return [start, end) runs where profile > thresh, merging small gaps."""
    on = profile > thresh
    out = []
    i, n = 0, len(on)
    while i < n:
        if on[i]:
            j = i
            while j < n and on[j]:
                j += 1
            out.append([i, j])
            i = j
        else:
            i += 1
    merged = []
    for r in out:
        if merged and r[0] - merged[-1][1] < min_gap:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [r for r in merged if r[1] - r[0] > 6]


def slice_sheet(im, rows_chars, min_gap=24):
    a = np.array(im.split()[-1]) > 24
    row_runs = runs(a.sum(axis=1), min_gap)
    assert len(row_runs) == len(rows_chars), (len(row_runs), row_runs)
    glyphs = {}
    for (y0, y1), chars in zip(row_runs, rows_chars):
        band = a[y0:y1]
        col_runs = runs(band.sum(axis=0), min_gap)
        assert len(col_runs) == len(chars), (chars, col_runs)
        for (x0, x1), ch in zip(col_runs, chars):
            g = im.crop((x0, y0, x1, y1))
            ga = np.array(g.split()[-1]) > 24
            ys = np.where(ga.any(axis=1))[0]
            g = g.crop((0, ys.min(), g.width, ys.max() + 1))
            glyphs[ch] = (g, y0 + ys.min(), y0 + ys.max() + 1)
    return glyphs


def build_font():
    letters = slice_sheet(load("29_font"), ["ABCDEF", "GHIJKL", "MNOPQR", "STUVWX", "YZ0123", "456789"])
    punct = slice_sheet(load("30_punct"), ["!:.", "+-/"])
    punct2 = slice_sheet(load("62_punct2"), ["?,'", "()%", "*&#"])

    # Normalise everything to a common cap height.
    cap = int(np.median([g.height for ch, (g, _, _) in letters.items() if ch not in "Q"]))
    target = 96
    s = target / cap
    p_cap = punct["!"][0].height
    ps = target / p_cap

    align = {"!": "top", ":": "bottom", ".": "bottom", "+": "center", "-": "center", "/": "center",
             "?": "top", ",": "comma", "'": "top", "(": "center", ")": "center", "%": "top",
             "*": "top", "&": "top", "#": "top"}
    items = []
    for ch, (g, _, _) in letters.items():
        g = g.resize((round(g.width * s), round(g.height * s)), Image.LANCZOS)
        items.append((ch, g, "top"))
    for ch, (g, _, _) in punct.items():
        g = g.resize((max(1, round(g.width * ps)), max(1, round(g.height * ps))), Image.LANCZOS)
        items.append((ch, g, align[ch]))
    ps2 = target / punct2["?"][0].height
    for ch, (g, _, _) in punct2.items():
        g = g.resize((max(1, round(g.width * ps2)), max(1, round(g.height * ps2))), Image.LANCZOS)
        items.append((ch, g, align[ch]))

    # Simple shelf packing.
    atlas_w, x, y, shelf = 1024, 2, 2, 0
    placed = []
    for ch, g, al in items:
        if x + g.width + 2 > atlas_w:
            x, y, shelf = 2, y + shelf + 2, 0
        placed.append((ch, g, al, x, y))
        x += g.width + 2
        shelf = max(shelf, g.height)
    atlas = Image.new("RGBA", (atlas_w, y + shelf + 2), (0, 0, 0, 0))
    meta = {"cap": target, "glyphs": {}}
    for ch, g, al, gx, gy in placed:
        atlas.alpha_composite(clean_alpha(g), (gx, gy))
        if al == "top":
            dy = 0
        elif al == "bottom":
            dy = target - g.height + round(0.06 * target)  # glyph sheets include a drop shadow
        elif al == "comma":
            dy = target - round(g.height * 0.55)
        else:
            dy = round((target - g.height) / 2)
        meta["glyphs"][ch] = {"x": gx, "y": gy, "w": g.width, "h": g.height, "dy": dy}
    atlas.save(os.path.join(OUT, "font", "font.webp"), "WEBP", quality=90, method=6)
    with open(os.path.join(OUT, "font", "font.json"), "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    print("font", atlas.size, "cap", cap, "->", target)


def main():
    for d in ("sprites", "ui", "tex", "font"):
        os.makedirs(os.path.join(OUT, d), exist_ok=True)
    manifest = {"sprites": {}, "ui": {}}
    for group, table in (("sprites", SPRITES), ("ui", UI)):
        for name, (raw, box) in table.items():
            if not os.path.exists(os.path.join(RAW, raw + ".png")):
                print("missing", raw)
                continue
            im = load(raw)
            if name == "joy_base":
                im = fix_joy_base(im)
            im = clean_alpha(fit(trim(im), box))
            save_webp(im, os.path.join(OUT, group, name + ".webp"))
            manifest[group][name] = [im.width, im.height]
    for name, raw in TEXTURES.items():
        tex = seamless(Image.open(os.path.join(RAW, raw + ".png")))
        tex.save(os.path.join(OUT, "tex", name + ".webp"), "WEBP", quality=82, method=6)
    splash = Image.open(os.path.join(RAW, "35_splash.png")).convert("RGB")
    splash.save(os.path.join(OUT, "ui", "splash.webp"), "WEBP", quality=80, method=6)
    manifest["ui"]["splash"] = list(splash.size)
    build_font()
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    print("done")


if __name__ == "__main__":
    main()
