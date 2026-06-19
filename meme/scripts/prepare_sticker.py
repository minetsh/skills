#!/usr/bin/env python3
"""Prepare a generated meme sticker PNG for transparent use.

This script removes a flat chroma-key background, resizes to a square output,
optionally adds a white outer stroke, and writes a small validation report.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Iterable, Tuple

from PIL import Image, ImageChops, ImageColor, ImageFilter, ImageStat


RGBA = Tuple[int, int, int, int]
RGB = Tuple[int, int, int]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Source PNG with a flat chroma-key background.")
    parser.add_argument("--output", required=True, help="Final transparent PNG path.")
    parser.add_argument("--size", type=int, default=240, help="Final square size in pixels (used when --width/--height are not set).")
    parser.add_argument("--width", type=int, help="Explicit output width; overrides --size. Use with --height for non-square assets (banner 750x400, appreciation 750x560 / 750x750).")
    parser.add_argument("--height", type=int, help="Explicit output height; overrides --size.")
    parser.add_argument("--key", help="Explicit key color, such as '#00ff00'.")
    parser.add_argument(
        "--auto-key",
        choices=["none", "border"],
        default="border",
        help="Sample the key color from the source image border.",
    )
    parser.add_argument("--transparent-threshold", type=float, default=12.0)
    parser.add_argument("--opaque-threshold", type=float, default=220.0)
    parser.add_argument("--outline", type=int, default=2, help="White outline width in final pixels. Use 0 to disable.")
    parser.add_argument("--outline-color", default="#ffffff", help="Outline color.")
    parser.add_argument("--no-despill", action="store_true", help="Disable simple green/magenta key-color despill.")
    parser.add_argument(
        "--despill-strength",
        type=float,
        default=1.0,
        help=(
            "How aggressively to neutralize key-color spill on the soft (partial-alpha) edge band, "
            "0..1. 1.0 fully neutralizes the green/magenta fringe (best for white/fluffy fur); "
            "lower it only if a genuinely green/magenta edge gets desaturated. Solid interior pixels "
            "always keep a gentle despill so pale subjects are not recolored."
        ),
    )
    parser.add_argument("--edge-contract", type=int, default=0, help="Contract alpha mask by this many pixels before resize.")
    parser.add_argument(
        "--keep-background",
        action="store_true",
        help="Opaque poster/banner mode: skip chroma-key removal, despill, edge-contract and outline; just resize and validate. Use for 横幅/赞赏引导图/赞赏致谢图/宣传海报.",
    )
    parser.add_argument("--max-bytes", type=int, help="Validate the output file is at most this many bytes (e.g. 512000 for 500KB, 102400 for 100KB).")
    parser.add_argument("--report", help="Optional JSON validation report path.")
    return parser.parse_args()


def color_distance(a: RGB, b: RGB) -> float:
    return math.sqrt(sum((int(x) - int(y)) ** 2 for x, y in zip(a, b)))


def border_pixels(image: Image.Image) -> Iterable[RGB]:
    rgb = image.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    for x in range(w):
        yield px[x, 0]
        yield px[x, h - 1]
    for y in range(1, h - 1):
        yield px[0, y]
        yield px[w - 1, y]


def sample_border_key(image: Image.Image) -> RGB:
    stat = ImageStat.Stat(Image.new("RGB", (1, 1)))
    pixels = list(border_pixels(image))
    # Median is robust to a few antialiased subject pixels touching the border.
    channels = []
    for channel in range(3):
        values = sorted(pixel[channel] for pixel in pixels)
        channels.append(values[len(values) // 2])
    key = tuple(channels)
    # Keep ImageStat referenced so linters do not remove the import if this file is copied.
    _ = stat
    return key  # type: ignore[return-value]


def resolve_key(image: Image.Image, key: str | None, auto_key: str) -> RGB:
    if key:
        parsed = ImageColor.getrgb(key)
        return parsed[:3]
    if auto_key == "border":
        return sample_border_key(image)
    return (0, 255, 0)


def remove_key(
    image: Image.Image,
    key: RGB,
    transparent_threshold: float,
    opaque_threshold: float,
    despill: bool,
    despill_strength: float = 1.0,
) -> Image.Image:
    if opaque_threshold <= transparent_threshold:
        raise ValueError("--opaque-threshold must be greater than --transparent-threshold")

    rgba = image.convert("RGBA")
    out = []
    key_r, key_g, key_b = key
    span = opaque_threshold - transparent_threshold

    # Chroma fringe lives in the partial-alpha edge band, so neutralize the key channel
    # harder there (scaled by despill_strength) while solid interior keeps a gentle bias
    # to avoid recoloring pale subjects.
    interior_bias = 18.0
    strength = max(0.0, min(1.0, despill_strength))
    edge_bias = interior_bias * (1.0 - strength)

    for r, g, b, original_a in iter_image_data(rgba):
        distance = color_distance((r, g, b), key)
        if distance <= transparent_threshold:
            alpha = 0
        elif distance >= opaque_threshold:
            alpha = original_a
        else:
            t = (distance - transparent_threshold) / span
            alpha = int(round(original_a * t))

        if despill and alpha > 0:
            is_edge = alpha < original_a
            bias = edge_bias if is_edge else interior_bias
            if key_g > key_r and key_g > key_b:
                g = min(g, int(round((r + b) / 2 + bias)))
            elif key_r > key_g and key_b > key_g:
                new_r = min(r, int(round((g + b) / 2 + bias)))
                new_b = min(b, int(round((r + g) / 2 + bias)))
                r, b = new_r, new_b

        out.append((r, g, b, alpha))

    rgba.putdata(out)
    return rgba


def contract_alpha(image: Image.Image, pixels: int) -> Image.Image:
    if pixels <= 0:
        return image
    alpha = image.getchannel("A")
    for _ in range(pixels):
        alpha = alpha.filter(ImageFilter.MinFilter(3))
    result = image.copy()
    result.putalpha(alpha)
    return result


def resize_to(image: Image.Image, width: int, height: int) -> Image.Image:
    return image.resize((width, height), Image.Resampling.LANCZOS)


def add_outline(image: Image.Image, width: int, color: str) -> Image.Image:
    if width <= 0:
        return image

    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    expanded = alpha
    for _ in range(width):
        expanded = expanded.filter(ImageFilter.MaxFilter(3))

    outline_alpha = ImageChops.subtract(expanded, alpha)
    outline = Image.new("RGBA", rgba.size, ImageColor.getrgb(color) + (255,))
    outline.putalpha(outline_alpha)
    return Image.alpha_composite(outline, rgba)


def alpha_corners(image: Image.Image) -> list[int]:
    a = image.getchannel("A")
    w, h = image.size
    px = a.load()
    return [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]


def iter_image_data(image: Image.Image):
    if hasattr(image, "get_flattened_data"):
        return image.get_flattened_data()
    return image.getdata()


def validate(
    image: Image.Image,
    path: Path,
    target: Tuple[int, int] | None = None,
    require_transparent: bool = True,
    max_bytes: int | None = None,
) -> dict:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    data = list(iter_image_data(alpha))
    nonzero = sum(1 for value in data if value > 0)
    opaque = sum(1 for value in data if value >= 250)
    partial = sum(1 for value in data if 0 < value < 250)
    transparent_pixels = sum(1 for value in data if value == 0)
    w, h = rgba.size
    corners = alpha_corners(rgba)
    size_bytes = path.stat().st_size if path.exists() else 0
    size_ok = True if target is None else [w, h] == [int(target[0]), int(target[1])]
    bytes_ok = True if max_bytes is None else size_bytes <= max_bytes
    if require_transparent:
        transparency_ok = nonzero > 0 and max(corners) == 0
    else:
        transparency_ok = transparent_pixels == 0
    report = {
        "path": str(path),
        "size": [w, h],
        "mode": rgba.mode,
        "corners_alpha": corners,
        "alpha_bbox": list(alpha.getbbox() or []),
        "nonzero_alpha_pixels": nonzero,
        "opaque_pixels": opaque,
        "partial_alpha_pixels": partial,
        "transparent_pixels": transparent_pixels,
        "coverage": round(nonzero / (w * h), 4) if w and h else 0,
        "bytes": size_bytes,
        "target_size": [int(target[0]), int(target[1])] if target else None,
        "max_bytes": max_bytes,
        "size_ok": size_ok,
        "bytes_ok": bytes_ok,
        "transparency_ok": transparency_ok,
        "require_transparent": require_transparent,
        "ok": bool(size_ok and bytes_ok and transparency_ok),
    }
    return report


def main() -> None:
    args = parse_args()
    source = Path(args.input)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)

    target_w = args.width if args.width else args.size
    target_h = args.height if args.height else args.size

    image = Image.open(source)

    if args.keep_background:
        final = resize_to(image.convert("RGBA"), target_w, target_h)
        final.convert("RGB").save(output)
        key = None
    else:
        key = resolve_key(image, args.key, args.auto_key)
        transparent = remove_key(
            image,
            key=key,
            transparent_threshold=args.transparent_threshold,
            opaque_threshold=args.opaque_threshold,
            despill=not args.no_despill,
            despill_strength=args.despill_strength,
        )
        transparent = contract_alpha(transparent, args.edge_contract)
        final = resize_to(transparent, target_w, target_h)
        final = add_outline(final, args.outline, args.outline_color)
        final.save(output)

    report = validate(
        Image.open(output),
        output,
        target=(target_w, target_h),
        require_transparent=not args.keep_background,
        max_bytes=args.max_bytes,
    )
    report["key_color"] = "#{:02x}{:02x}{:02x}".format(*key) if key else None
    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
