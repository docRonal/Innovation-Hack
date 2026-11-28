#!/usr/bin/env python3
"""Make the clean certificates look photographed: light perspective, shadow, noise, JPEG.

Reads pdf/*.pdf, writes degraded/jpg/*.jpg (one per page) and degraded/pdf/*.pdf
(a raster PDF of the same pages).

Requires Pillow (PIL) and poppler's pdftoppm; no project dependency is added.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent
PDF_DIR = ROOT / "pdf"
OUT_JPG = ROOT / "degraded" / "jpg"
OUT_PDF = ROOT / "degraded" / "pdf"

DESK = (210, 206, 197)
SHADOW = (58, 54, 48)
WARM = (255, 249, 235)


def _render_pages(pdf: Path, work: Path, dpi: int) -> list[Path]:
    subprocess.run(
        ["pdftoppm", "-png", "-r", str(dpi), str(pdf), str(work / "page")],
        check=True,
        capture_output=True,
    )
    pages = sorted(work.glob("page-*.png"))
    if not pages:
        raise SystemExit(f"{pdf.name}: pdftoppm produced no pages")
    return pages


def _degrade(page: Path, *, width: int) -> Image.Image:
    image = Image.open(page).convert("RGB")
    ratio = width / image.width
    image = image.resize((width, round(image.height * ratio)), Image.Resampling.LANCZOS)
    w, h = image.size

    # Mild perspective + tilt: map a trapezoid inside the page to the full frame.
    # Pillow's QUAD order is upper-left, lower-left, lower-right, upper-right.
    quad = (6, 3, 2, h - 7, w - 8, h - 3, w - 3, 8)
    image = image.transform((w, h), Image.Transform.QUAD, quad, Image.Resampling.BICUBIC)

    # Tilt the whole sheet, so the page edges and the desk are visible.
    page = image.convert("RGBA").rotate(
        1.2,
        expand=True,
        resample=Image.Resampling.BICUBIC,
        fillcolor=(0, 0, 0, 0),
    )
    page_w, page_h = page.size
    margin = 44
    canvas = Image.new("RGB", (page_w + margin * 2, page_h + margin * 2), DESK)
    desk_noise = Image.effect_noise(canvas.size, 10).convert("RGB")
    canvas = Image.blend(canvas, desk_noise, 0.10)

    # Soft shadow cast by the sheet.
    alpha = page.getchannel("A")
    shadow = Image.new("L", canvas.size, 0)
    shadow.paste(
        alpha.filter(ImageFilter.GaussianBlur(14)),
        (margin + 7, margin + 9),
    )
    canvas = Image.composite(Image.new("RGB", canvas.size, SHADOW), canvas, shadow)
    canvas.paste(page, (margin, margin), page)

    # Uneven lamp light: bright top-left, darker bottom-right.
    gradient = Image.linear_gradient("L").rotate(38, resample=Image.Resampling.BICUBIC)
    gradient = gradient.resize(canvas.size).convert("RGB")
    gradient = gradient.point(lambda value: 218 + value * 37 // 255)
    canvas = ImageChops.multiply(canvas, gradient)

    # Warm paper cast and a little desaturation.
    canvas = Image.blend(canvas, Image.new("RGB", canvas.size, WARM), 0.035)
    canvas = ImageEnhance.Color(canvas).enhance(0.9)

    # Sensor noise.
    noise = Image.effect_noise(canvas.size, 6).convert("RGB")
    canvas = ImageChops.add(canvas, noise, scale=1.0, offset=-128)

    # Slight optical softness and lower contrast, like a phone photo.
    canvas = canvas.filter(ImageFilter.GaussianBlur(0.55))
    canvas = ImageEnhance.Contrast(canvas).enhance(0.94)
    canvas = ImageEnhance.Brightness(canvas).enhance(0.99)

    # Weak vignette at the edges.
    vignette = Image.radial_gradient("L").resize(canvas.size)
    mask = vignette.point(lambda value: value * 0.16)
    canvas = Image.composite(
        Image.new("RGB", canvas.size, (28, 26, 22)),
        canvas,
        mask,
    )

    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--width", type=int, default=1600, help="output image width in px")
    parser.add_argument("--dpi", type=int, default=200, help="PDF render resolution")
    parser.add_argument("--quality", type=int, default=78, help="JPEG quality")
    args = parser.parse_args()

    if shutil.which("pdftoppm") is None:
        print("pdftoppm not found in PATH (poppler-utils)", file=sys.stderr)
        return 1

    sources = sorted(PDF_DIR.glob("*.pdf"))
    if not sources:
        print(f"no PDFs in {PDF_DIR}; run generate.py first", file=sys.stderr)
        return 1

    OUT_JPG.mkdir(parents=True, exist_ok=True)
    OUT_PDF.mkdir(parents=True, exist_ok=True)

    for source in sources:
        jpgs: list[Path] = []
        with tempfile.TemporaryDirectory() as tmp:
            pages = _render_pages(source, Path(tmp), args.dpi)
            for index, page in enumerate(pages, start=1):
                image = _degrade(page, width=args.width)
                jpg = OUT_JPG / f"{source.stem}-{index}.jpg"
                image.save(jpg, "JPEG", quality=args.quality, subsampling=2, optimize=True)
                jpgs.append(jpg)
                print(f"{jpg.relative_to(ROOT)}")

        raster_pages = [Image.open(path).convert("RGB") for path in jpgs]
        pdf = OUT_PDF / f"{source.stem}.pdf"
        raster_pages[0].save(
            pdf,
            "PDF",
            resolution=args.dpi,
            save_all=True,
            append_images=raster_pages[1:],
        )
        print(f"{pdf.relative_to(ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
