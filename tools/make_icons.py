#!/usr/bin/env python3
"""Compose the PWA icons from generated sprites (UFO over a navy enamel badge)."""
import os
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..")
ufo = Image.open(os.path.join(ROOT, "assets/sprites/ufo.webp")).convert("RGBA")
cow = Image.open(os.path.join(ROOT, "assets/sprites/cow.webp")).convert("RGBA")
S = 1024
im = Image.new("RGBA", (S, S), (11, 20, 51, 255))
glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(glow)
d.polygon([(S * 0.42, S * 0.42), (S * 0.58, S * 0.42), (S * 0.72, S * 0.86), (S * 0.28, S * 0.86)], fill=(90, 230, 255, 120))
glow = glow.filter(ImageFilter.GaussianBlur(28))
im.alpha_composite(glow)
c = cow.resize((int(S * 0.3), int(S * 0.3 * cow.height / cow.width)), Image.LANCZOS).rotate(18, expand=True, resample=Image.BICUBIC)
im.alpha_composite(c, (int(S * 0.5 - c.width / 2), int(S * 0.6)))
u = ufo.resize((int(S * 0.78), int(S * 0.78 * ufo.height / ufo.width)), Image.LANCZOS)
im.alpha_composite(u, (int(S * 0.11), int(S * 0.12)))
ring = ImageDraw.Draw(im)
ring.rounded_rectangle([18, 18, S - 18, S - 18], radius=200, outline=(196, 35, 27, 255), width=36)
ring.rounded_rectangle([60, 60, S - 60, S - 60], radius=165, outline=(243, 230, 200, 255), width=10)
for size in (512, 192):
    im.resize((size, size), Image.LANCZOS).save(os.path.join(ROOT, f"assets/icons/icon-{size}.png"), optimize=True)
print("icons ok")
