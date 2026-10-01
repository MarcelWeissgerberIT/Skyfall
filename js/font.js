// Bitmap font renderer for the generated glyph atlas.
export class BitmapFont {
  constructor(img, meta) {
    this.img = img;
    this.cap = meta.cap;
    this.g = meta.glyphs;
    this.track = -0.07 * this.cap; // outlines overlap a little, like a printed poster
    let dw = 0;
    for (const d of '0123456789') dw = Math.max(dw, this.g[d].w);
    this.digitW = dw;
  }

  adv(ch) {
    if (ch === ' ') return this.cap * 0.34;
    if (ch >= '0' && ch <= '9') return this.digitW + this.track;
    const g = this.g[ch];
    if (!g) return this.cap * 0.34;
    return g.w + this.track;
  }

  measure(text, size) {
    const s = size / this.cap;
    let w = 0;
    for (const ch of text) w += this.adv(ch);
    return Math.max(0, (w - this.track) * s);
  }

  // Draws text with its cap-top at y. align: 0 = left, 0.5 = centre, 1 = right.
  draw(ctx, text, x, y, size, align = 0) {
    text = String(text).toUpperCase();
    const s = size / this.cap;
    let cx = x - this.measure(text, size) * align;
    for (const ch of text) {
      const g = this.g[ch];
      if (g) {
        let ox = 0;
        if (ch >= '0' && ch <= '9') ox = (this.digitW - g.w) / 2;
        ctx.drawImage(this.img, g.x, g.y, g.w, g.h, cx + ox * s, y + g.dy * s, g.w * s, g.h * s);
      }
      cx += this.adv(ch) * s;
    }
  }

  // Word-wrap text into lines that fit maxW at the given size.
  wrap(text, size, maxW) {
    const words = String(text).toUpperCase().split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (this.measure(t, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }
}
