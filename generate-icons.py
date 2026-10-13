#!/usr/bin/env python3
"""Régénère les icônes PNG de la PWA (facultatif : elles sont déjà fournies dans public/icons)."""
from PIL import Image, ImageDraw

def make(size, maskable=False, out="icon.png"):
    S = size * 4  # sur-échantillonnage pour lisser
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # dégradé diagonal
    grad = Image.new("RGBA", (S, S))
    gp = grad.load()
    c1, c2 = (99, 102, 241), (124, 58, 237)
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * S)
            gp[x, y] = tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3)) + (255,)
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    if maskable:
        md.rectangle([0, 0, S, S], fill=255)
    else:
        md.rounded_rectangle([0, 0, S, S], radius=int(S * 0.22), fill=255)
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    k = 0.62 if maskable else 0.78   # zone de sécurité pour l'icône « maskable »
    off = (1 - k) / 2
    def P(x, y):
        return (int(S * (off + k * x)), int(S * (off + k * y)))
    w = int(S * 0.085 * k / 0.78)
    pts = [P(0.0, 0.88), P(0.0, 0.12), P(0.5, 0.62), P(1.0, 0.12), P(1.0, 0.88)]
    d.line(pts, fill="white", width=w, joint="curve")
    for p in (pts[0], pts[-1], pts[1], pts[3]):
        d.ellipse([p[0] - w // 2, p[1] - w // 2, p[0] + w // 2, p[1] + w // 2], fill="white")
    r = int(S * 0.045)
    cx, cy = P(0.97, 0.02)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(253, 230, 138))
    img = img.resize((size, size), Image.LANCZOS)
    img.save(out)

if __name__ == "__main__":
    import os
    here = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
    make(192, False, os.path.join(here, "icon-192.png"))
    make(512, False, os.path.join(here, "icon-512.png"))
    make(512, True, os.path.join(here, "maskable-512.png"))
    make(180, True, os.path.join(here, "apple-touch-icon.png"))
    print("Icônes générées dans", here)
