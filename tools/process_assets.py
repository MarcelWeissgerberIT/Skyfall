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
    "pk_medkit": ("25_medkit", (140, 140)),
    "pk_core": ("26_core", (140, 140)),
    "meteor": ("27_meteor", (260, 260)),
    "house_c": ("48_house_c", (520, 520)),
    "car_sheriff": ("49_sheriff", (300, 300)),
    "streetlight": ("50_streetlight", (300, 300)),
    "hydrant": ("51_hydrant", (90, 90)),
    "cow": ("52_cow", (200, 200)),
    "sandbags": ("53_sandbags", (240, 240)),
    "trailer": ("54_trailer", (360, 360)),
    "civ_dad": ("56_civ_dad", (200, 200)),
    "civ_curlers": ("57_civ_curlers", (200, 200)),
    "civ_tinfoil": ("58_civ_tinfoil", (200, 200)),
    "tumbleweed": ("59_tumbleweed", (120, 120)),
    "vulture": ("60_vulture", (220, 220)),
    "flamingo": ("61_flamingo", (90, 90)),
    "police_rear": ("90_police_rear", (300, 300)),
    "police_side": ("91_police_side", (300, 300)),
    "police_front": ("92_police_front", (200, 200)),
    "police_back": ("93_police_back", (200, 200)),
    "bus": ("94_bus", (440, 440)),
    "pickup_rear": ("a0_pickup_rear", (300, 300)),
    "pickup_side": ("a1_pickup_side", (300, 300)),
    "pickup_front": ("a2_pickup_front", (200, 200)),
    "pickup_back": ("a3_pickup_back", (200, 200)),
    "minivan_rear": ("a4_minivan_rear", (300, 300)),
    "minivan_side": ("a5_minivan_side", (300, 300)),
    "minivan_front": ("a6_minivan_front", (200, 200)),
    "minivan_back": ("a7_minivan_back", (200, 200)),
    "sheriff_rear": ("a8_sheriff_rear", (300, 300)),
    "sheriff_side": ("a9_sheriff_side", (300, 300)),
    "sheriff_front": ("aa_sheriff_front", (200, 200)),
    "sheriff_back": ("ab_sheriff_back", (200, 200)),
    "pk_fuel": ("ae_fuel", (140, 140)),
    "pk_tools": ("af_tools", (140, 140)),
    "dog": ("ai_dog", (160, 160)),
    # --- adventure: story characters (also used big in the interior scenes)
    "npc_kevin": ("b0_kevin", (360, 520)),
    "npc_mel": ("b1_mel", (360, 520)),
    "npc_brenda": ("b2_brenda", (360, 520)),
    "npc_gloria": ("b3_gloria", (380, 520)),
    "npc_barb": ("b4_barb", (380, 520)),
    "npc_zorp": ("b5_zorp", (360, 520)),
    "npc_sheriff": ("b6_sheriff", (360, 520)),
    "npc_hoa": ("b7_hoa_lady", (220, 300)),
    "npc_biker": ("b8_biker", (220, 300)),
    "npc_cultist": ("b9_cultist", (220, 300)),
    "npc_warden": ("ba_warden", (220, 300)),
    "drone": ("bb_drone", (200, 200)),
    # --- landmarks
    "tower": ("c0_tower", (420, 640)),
    "drive_in": ("c1_drivein", (520, 520)),
    "net_trailer": ("c2_trailer", (460, 460)),
    "checkpoint": ("c3_checkpoint", (420, 420)),
    "pylon": ("c4_pylon", (120, 220)),
    "church": ("c5_church", (520, 520)),
    "clubhouse": ("c6_clubhouse", (520, 520)),
    "diner": ("c7_diner", (500, 500)),
    "motel": ("c8_motel", (520, 520)),
    "saloon": ("c9_saloon", (520, 520)),
    "bunker": ("ca_bunker", (400, 400)),
    "sheriff_office": ("cb_sheriff_office", (500, 500)),
    # --- props
    "billboard_a": ("d0_billboard_a", (400, 400)),
    "billboard_b": ("d1_billboard_b", (400, 400)),
    "burn_barrel": ("d2_barrel", (150, 150)),
    "barricade": ("d3_barricade", (360, 360)),
    "phone_booth": ("d4_phone", (180, 260)),
    "icecream": ("d5_icecream", (340, 340)),
    "porta_potty": ("d6_potty", (170, 240)),
    "speaker_pole": ("d7_speaker", (200, 300)),
    "crashed_ufo": ("d8_crashed_ufo", (440, 440)),
    "saguaro": ("d9_saguaro", (180, 280)),
    "junk_pile": ("da_junk", (400, 400)),
    "gnome": ("db_gnome", (140, 180)),
}

# inventory items (assets/sprites/it_*.webp)
ITEMS = {
    "lanyard": "i00_lanyard", "setpass": "i01_setpass", "remote": "i02_remote", "dynamite": "i03_dynamite",
    "pie": "i04_pie", "coffee": "i05_coffee", "keys": "i06_keys", "donut": "i07_donut", "cowbell": "i08_cowbell",
    "tape_hoa": "i09_tape_hoa", "tape_sermon": "i10_tape_sermon", "tape_metal": "i11_tape_metal",
    "tape_cow": "i12_tape_cow", "tape_kevin": "i13_tape_kevin", "keycard": "i14_keycard", "megaphone": "i15_megaphone",
    "finebook": "i16_finebook", "coupons": "i17_coupons", "fuse": "i18_fuse", "cables": "i19_cables",
    "slime": "i20_slime", "beans": "i21_beans", "tinfoil": "i22_tinfoil", "photo": "i23_photo", "gnome": "db_gnome", "trophy": "i24_trophy",
}

# interior point & click scenes (assets/scenes/*.webp, loaded on demand)
SCENES = {
    "bunker": "s0_bunker", "diner": "s1_diner", "church": "s2_church", "clubhouse": "s3_clubhouse",
    "saloon": "s4_saloon", "office": "s5_office", "sheriff": "s6_sheriff", "control": "s7_control",
    # ending art
    "end_kevin": "f1_end_kevin", "end_hoa": "f2_end_hoa", "end_church": "f3_end_church",
    "end_metal": "f4_end_metal", "end_cow": "f5_end_cow",
}

UI = {
    "logo": ("28_logo", (960, 960)),
    "icon_heart": ("31_i_heart", (128, 128)),
    "icon_clock": ("33_i_clock", (128, 128)),
    "icon_skull": ("34_i_skull", (128, 128)),
    "btn_pause": ("36_b_pause", (160, 160)),
    "joy_base": ("37_joy_base", (320, 320)),
    "joy_knob": ("38_joy_knob", (180, 180)),
    "btn_wide": ("39_button", (640, 640)),
    "panel": ("40_panel", (640, 640)),
    "icon_radio": ("63_i_radio", (128, 128)),
    "btn_search": ("95_b_search", (180, 180)),
    "btn_drive": ("96_b_drive", (180, 180)),
    "btn_talk": ("97_b_talk", (180, 180)),
    "btn_pet": ("98_b_pet", (180, 180)),
    "btn_rig": ("99_b_rig", (180, 180)),
    "btn_exit": ("9a_b_exit", (180, 180)),
    "btn_honk": ("ac_b_honk", (200, 200)),
    "btn_boost": ("ad_b_boost", (180, 180)),
    "icon_fuel": ("ag_i_fuel", (128, 128)),
    "icon_seat": ("ah_i_seat", (128, 128)),
    "em_hoa": ("e0_em_hoa", (160, 160)),
    "em_church": ("e1_em_church", (160, 160)),
    "em_rats": ("e2_em_rats", (160, 160)),
    "em_network": ("e3_em_network", (160, 160)),
    "btn_bag": ("e4_b_bag", (160, 160)),
    "btn_journal": ("e5_b_journal", (160, 160)),
    "btn_look": ("e6_b_look", (160, 160)),
    "btn_use": ("e7_b_use", (160, 160)),
    "btn_map": ("e8_b_map", (160, 160)),
    "btn_enter": ("e9_b_enter", (180, 180)),
    "icon_coupon": ("ea_i_coupon", (128, 128)),
    "icon_camera": ("eb_i_camera", (128, 128)),
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


def punch(im, sat=1.18, con=1.05):
    """The colour boost the game used to apply as a CSS filter on every frame:
    saturate(1.18) contrast(1.05), baked into the pixels once."""
    mode = im.mode
    a = np.asarray(im.convert("RGBA")).astype(np.float32) / 255.0
    rgb = a[..., :3]
    m = np.array([
        [0.213 + 0.787 * sat, 0.715 - 0.715 * sat, 0.072 - 0.072 * sat],
        [0.213 - 0.213 * sat, 0.715 + 0.285 * sat, 0.072 - 0.072 * sat],
        [0.213 - 0.213 * sat, 0.715 - 0.715 * sat, 0.072 + 0.928 * sat],
    ], dtype=np.float32)
    rgb = np.clip(rgb @ m.T, 0, 1)
    rgb = np.clip((rgb - 0.5) * con + 0.5, 0, 1)
    a[..., :3] = rgb
    out = Image.fromarray((a * 255 + 0.5).astype(np.uint8), "RGBA")
    return out.convert(mode) if mode != "RGBA" else out


def save_webp(im, path, q=88):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    punch(im).save(path, "WEBP", quality=q, method=6)


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
    punch(atlas).save(os.path.join(OUT, "font", "font.webp"), "WEBP", quality=90, method=6)
    with open(os.path.join(OUT, "font", "font.json"), "w") as f:
        json.dump(meta, f, separators=(",", ":"))
    print("font", atlas.size, "cap", cap, "->", target)


def main():
    for d in ("sprites", "ui", "tex", "font", "scenes"):
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
        tex = punch(seamless(Image.open(os.path.join(RAW, raw + ".png"))))
        tex.save(os.path.join(OUT, "tex", name + ".webp"), "WEBP", quality=82, method=6)
    for name, raw in ITEMS.items():
        im = clean_alpha(fit(trim(load(raw)), (160, 160)))
        save_webp(im, os.path.join(OUT, "sprites", "it_" + name + ".webp"))
        manifest["sprites"]["it_" + name] = [im.width, im.height]
    manifest["scenes"] = {}
    for name, raw in SCENES.items():
        im = Image.open(os.path.join(RAW, raw + ".png")).convert("RGB").resize((1280, 1280), Image.LANCZOS)
        save_webp(im, os.path.join(OUT, "scenes", name + ".webp"), q=80)
        manifest["scenes"][name] = [im.width, im.height]
    # the iron bars of the sheriff's jail cell as an overlay, so the sheriff can stand behind them
    cell = Image.open(os.path.join(RAW, SCENES["sheriff"] + ".png")).convert("RGB").resize((1280, 1280), Image.LANCZOS)
    box = (0, int(0.08 * 1280), int(0.33 * 1280), int(0.72 * 1280))
    c = np.asarray(cell.crop(box)).astype(np.float32)
    lum = c[..., 0] * 0.3 + c[..., 1] * 0.59 + c[..., 2] * 0.11
    sat = c.max(axis=2) - c.min(axis=2)
    a = np.clip((70 - lum) / 30, 0, 1) * np.clip((40 - sat) / 20, 0, 1)
    bars = np.dstack([c, a * 255]).astype(np.uint8)
    save_webp(Image.fromarray(bars, "RGBA"), os.path.join(OUT, "scenes", "sheriff_bars.webp"), q=90)
    manifest["scenes"]["sheriff_bars"] = [box[2] - box[0], box[3] - box[1]]
    splash = punch(Image.open(os.path.join(RAW, "35_splash.png")).convert("RGB"))
    splash.save(os.path.join(OUT, "ui", "splash.webp"), "WEBP", quality=80, method=6)
    manifest["ui"]["splash"] = list(splash.size)
    build_font()
    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=1)
    print("done")


if __name__ == "__main__":
    main()
