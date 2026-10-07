"""Generate PWA icons into public/icons/. Run with the Pillow venv python."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
S = 1024  # draw large, downsample for smooth edges


def draw() -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, 0, S - 1, S - 1), radius=S // 5, fill="#4a2c17")  # wood
    b = S // 14
    d.rounded_rectangle((b, b, S - 1 - b, S - 1 - b), radius=S // 5 - b, fill="#0e5a3f")  # felt

    cue = (S * 0.30, S * 0.70)
    one = (S * 0.70, S * 0.30)
    r = S * 0.11

    # dashed aim line
    dx, dy = one[0] - cue[0], one[1] - cue[1]
    length = (dx * dx + dy * dy) ** 0.5
    ux, uy = dx / length, dy / length
    pos, dash, gap = r * 1.5, S * 0.04, S * 0.035
    while pos + dash < length - r * 1.5:
        d.line((cue[0] + ux * pos, cue[1] + uy * pos,
                cue[0] + ux * (pos + dash), cue[1] + uy * (pos + dash)),
               fill=(255, 255, 255, 200), width=int(S * 0.015))
        pos += dash + gap

    def ball(c, fill):
        d.ellipse((c[0] - r, c[1] - r, c[0] + r, c[1] + r), fill=fill, outline="#1a1a1a", width=int(S * 0.008))
        h = r * 0.35
        d.ellipse((c[0] - r * 0.5, c[1] - r * 0.55, c[0] - r * 0.5 + h, c[1] - r * 0.55 + h), fill=(255, 255, 255, 140))

    ball(cue, "#ffffff")
    ball(one, "#f5c518")
    # "1" marker on the yellow ball
    d.ellipse((one[0] - r * 0.42, one[1] - r * 0.42, one[0] + r * 0.42, one[1] + r * 0.42), fill="#ffffff")
    d.rectangle((one[0] - r * 0.05, one[1] - r * 0.28, one[0] + r * 0.09, one[1] + r * 0.28), fill="#1a1a1a")
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    base = draw()
    for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)):
        img = base.resize((size, size), Image.LANCZOS)
        if name == "apple-touch-icon.png":  # iOS rounds corners itself; avoid transparent corners
            bg = Image.new("RGB", (size, size), "#0e5a3f")
            bg.paste(img, mask=img.split()[3])
            img = bg
        img.save(OUT / name)


if __name__ == "__main__":
    main()
