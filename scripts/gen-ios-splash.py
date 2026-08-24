"""Generate the iOS `apple-touch-startup-image` launch screens.

Unlike Android, iOS does NOT derive a launch screen from the web app
manifest — an installed PWA with no `apple-touch-startup-image` launches
to a blank screen. Each image must match a device's EXACT pixel
dimensions or iOS silently ignores it and falls back to blank, which is
why the devices below are enumerated rather than generated from a
formula.

Light and dark variants both ship: the app boots into the merchant's
STORED theme, so a merchant on dark would otherwise get a white flash
before first paint. Only the one matching entry is ever downloaded.

Usage:
    python scripts/gen-ios-splash.py

Writes into public/pwa/ios/ and prints the <link> tags for index.html.
Re-run after changing the mark or either background colour, then paste
the printed tags over the existing block in index.html.
"""

import os

from PIL import Image

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(_ROOT, "public", "pwa", "ios")

# The same asset the CSS mask uses, so the launch screen and the splash it
# hands off to carry an identical mark.
MARK = os.path.join(_ROOT, "public", "numu-mark-mask.webp")

# Backgrounds match #numu-splash in index.html exactly, so the launch
# screen and the splash that follows it are the same colour.
LIGHT_BG = (255, 255, 255)
DARK_BG = (11, 20, 32)  # #0B1420

# (portrait_width_px, portrait_height_px, css_w, css_h, device_pixel_ratio)
DEVICES = [
    (1170, 2532, 390, 844, 3),    # iPhone 12/13/14
    (1179, 2556, 393, 852, 3),    # iPhone 14 Pro / 15 / 16
    (1206, 2622, 402, 874, 3),    # iPhone 16 Pro
    (1284, 2778, 428, 926, 3),    # iPhone 12/13/14 Plus, Pro Max
    (1290, 2796, 430, 932, 3),    # iPhone 14 Pro Max / 15 Pro Max
    (1320, 2868, 440, 956, 3),    # iPhone 16 Pro Max
    (1125, 2436, 375, 812, 3),    # iPhone X / XS / 11 Pro
    (1242, 2688, 414, 896, 3),    # iPhone XS Max / 11 Pro Max
    (828, 1792, 414, 896, 2),     # iPhone XR / 11
    (750, 1334, 375, 667, 2),     # iPhone SE 2/3, 8
    (1536, 2048, 768, 1024, 2),   # iPad 9.7"
    (1668, 2224, 834, 1112, 2),   # iPad Pro 10.5"
    (1668, 2388, 834, 1194, 2),   # iPad Pro 11"
    (2048, 2732, 1024, 1366, 2),  # iPad Pro 12.9"
]


def build(width, height, bg, mark):
    """One launch screen: flat ground, mark centred."""
    canvas = Image.new("RGB", (width, height), bg)
    # A quarter of the shorter edge matches the optical weight of the 69px
    # mark on the 390px-wide splash it hands off to.
    target_w = int(min(width, height) * 0.26)
    target_h = int(target_w * (mark.height / mark.width))
    resized = mark.resize((target_w, target_h), Image.LANCZOS)
    canvas.paste(resized, ((width - target_w) // 2, (height - target_h) // 2), resized)
    return canvas


def main():
    os.makedirs(OUT, exist_ok=True)
    mark = Image.open(MARK).convert("RGBA")

    links = []
    total = 0
    for width, height, css_w, css_h, dpr in DEVICES:
        for scheme, bg in (("light", LIGHT_BG), ("dark", DARK_BG)):
            name = "splash-{}x{}-{}.png".format(width, height, scheme)
            path = os.path.join(OUT, name)
            # Palette mode: a flat ground plus one flat-coloured mark is
            # lossless in 256 colours, and roughly halves what a merchant
            # downloads on install.
            build(width, height, bg, mark).convert(
                "P", palette=Image.ADAPTIVE, colors=256
            ).save(path, optimize=True)
            total += os.path.getsize(path)

            links.append(
                '    <link rel="apple-touch-startup-image" '
                'media="(device-width: {}px) and (device-height: {}px) '
                "and (-webkit-device-pixel-ratio: {}) and (orientation: portrait) "
                'and (prefers-color-scheme: {})" href="/pwa/ios/{}" />'.format(
                    css_w, css_h, dpr, scheme, name
                )
            )

    print("generated {} images, {:.0f} KiB total\n".format(len(links), total / 1024))
    # Printed, not written into public/: the tags belong in index.html, and a
    # stray file under public/ would ship as a dead asset.
    print("\n".join(links))


if __name__ == "__main__":
    main()
