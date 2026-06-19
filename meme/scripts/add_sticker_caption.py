#!/usr/bin/env python3
"""Add a compact Chinese caption to a transparent sticker PNG."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--text", required=True)
    parser.add_argument("--font", default="/System/Library/Fonts/Hiragino Sans GB.ttc")
    parser.add_argument("--font-size", type=int, default=28)
    parser.add_argument("--bottom", type=int, default=12)
    parser.add_argument("--fill", default="#ff7da8")
    parser.add_argument("--stroke-fill", default="#ffffff")
    parser.add_argument("--stroke-width", type=int, default=4)
    parser.add_argument("--shadow", default="#6a4a5a")
    parser.add_argument("--shadow-alpha", type=int, default=80)
    return parser.parse_args()


def load_font(path: str, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size=size)
    except OSError:
        return ImageFont.load_default(size=size)


def fit_font(text: str, font_path: str, max_width: int, start_size: int) -> ImageFont.FreeTypeFont:
    size = start_size
    while size >= 14:
        font = load_font(font_path, size)
        left, top, right, bottom = ImageDraw.Draw(Image.new("RGBA", (1, 1))).textbbox(
            (0, 0),
            text,
            font=font,
            stroke_width=4,
        )
        if right - left <= max_width:
            return font
        size -= 1
    return load_font(font_path, 14)


def main() -> None:
    args = parse_args()
    image = Image.open(args.input).convert("RGBA")
    width, height = image.size
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    font = fit_font(args.text, args.font, int(width * 0.74), args.font_size)
    draw_probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    bbox = draw_probe.textbbox((0, 0), args.text, font=font, stroke_width=args.stroke_width)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (width - text_width) / 2 - bbox[0]
    y = height - args.bottom - text_height - bbox[1]

    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_color = Image.new("RGBA", (1, 1), args.shadow).getpixel((0, 0))[:3] + (args.shadow_alpha,)
    shadow_draw.text(
        (x, y + 2),
        args.text,
        font=font,
        fill=shadow_color,
        stroke_width=args.stroke_width,
        stroke_fill=(255, 255, 255, min(255, args.shadow_alpha + 80)),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(0.5))

    draw = ImageDraw.Draw(layer)
    draw.text(
        (x, y),
        args.text,
        font=font,
        fill=args.fill,
        stroke_width=args.stroke_width,
        stroke_fill=args.stroke_fill,
    )
    Image.alpha_composite(Image.alpha_composite(image, shadow), layer).save(output)


if __name__ == "__main__":
    main()
