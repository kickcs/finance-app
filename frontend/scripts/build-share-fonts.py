#!/usr/bin/env python3
"""
Пересобирает шрифты карточек шаринга из вариативных исходников Google Fonts.

Запускается вручную при смене шрифта; результат коммитится. Нужен fonttools:
    pip install 'fonttools[woff]' brotli

    python3 frontend/scripts/build-share-fonts.py
"""

import io
import pathlib
import subprocess

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = pathlib.Path(__file__).resolve().parents[2]
WEB = ROOT / "frontend" / "public" / "share-fonts"
NATIVE = ROOT / "backend" / "assets" / "fonts"

GOLOS_VF = "https://raw.githubusercontent.com/google/fonts/main/ofl/golostext/GolosText%5Bwght%5D.ttf"
PLEX = "https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexmono/IBMPlexMono-{}.ttf"

# Ровно то, что карточки рисуют. U+00A0 — им Intl.NumberFormat разделяет разряды,
# U+2212 — минус в сумме-герое, U+2026 — многоточие обрезки, U+00B7 — разделитель.
UNICODES = (
    "0020-007E,00A0,00A2-00A5,00B7,"
    "0400-045F,0490-0491,"
    "2013,2014,2026,2116,2212,"
    "20AC,20B4,20B8,20BD"
)


def codepoints() -> list[int]:
    out: list[int] = []
    for part in UNICODES.split(","):
        if "-" in part:
            lo, hi = part.split("-")
            out.extend(range(int(lo, 16), int(hi, 16) + 1))
        else:
            out.append(int(part, 16))
    return out


def fetch(url: str) -> bytes:
    """Через curl, а не urllib: у системного python нет своего набора CA."""
    print(f"  <- {url}")
    return subprocess.run(
        ["curl", "-fsSL", url], check=True, capture_output=True
    ).stdout


def subset(font: TTFont) -> TTFont:
    options = Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    subsetter = Subsetter(options=options)
    subsetter.populate(unicodes=codepoints())
    subsetter.subset(font)
    return font


def emit(font: TTFont, stem: str) -> None:
    font.flavor = None
    native = NATIVE / f"{stem}.ttf"
    font.save(native)

    font.flavor = "woff2"
    web = WEB / f"{stem}.woff2"
    font.save(web)

    print(
        f"  -> {native.name} {native.stat().st_size // 1024} KB"
        f" | {web.name} {web.stat().st_size // 1024} KB"
    )


def main() -> None:
    WEB.mkdir(parents=True, exist_ok=True)
    NATIVE.mkdir(parents=True, exist_ok=True)

    print("Golos Text")
    golos_src = fetch(GOLOS_VF)
    for weight in (500, 600, 800):
        variable = TTFont(io.BytesIO(golos_src))
        static = instancer.instantiateVariableFont(
            variable, {"wght": weight}, updateFontNames=True
        )
        emit(subset(static), f"golos-{weight}")

    print("IBM Plex Mono")
    for weight, name in ((500, "Medium"), (600, "SemiBold")):
        font = TTFont(io.BytesIO(fetch(PLEX.format(name))))
        emit(subset(font), f"plex-mono-{weight}")


if __name__ == "__main__":
    main()
