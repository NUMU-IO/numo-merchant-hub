/**
 * PWA icon generator — NUMU merchant hub.
 *
 * Deliberately NOT using @vite-pwa/assets-generator: it depends on `sharp`,
 * which pulls libvips and added 3 HIGH advisories to `npm audit` (verified
 * 2026-08-08 — baseline 8 vulns became 11). Icons are generated once and
 * committed, so a build-time image dependency buys us nothing.
 *
 * This script is a no-dependency reference for HOW the committed icons in
 * public/pwa/ were produced. It is not wired into the build. Re-run it only
 * when the source art changes:
 *
 *     node scripts/generate-pwa-icons.mjs        (requires Python + Pillow)
 *
 * Source art: public/numu-app-icon.png — 1024x1024 RGBA, full-bleed navy
 * tile with a 1px antialiased corner ring (measured, not assumed).
 *
 * Outputs (public/pwa/):
 *   icon-192.png       purpose "any"      — resized source
 *   icon-512.png       purpose "any"      — resized source
 *   maskable-512.png   purpose "maskable" — mark rebuilt inside the 80% safe
 *                                           circle on full-bleed navy, NO
 *                                           transparency and no rounded
 *                                           corners (the OS supplies the mask)
 *   badge-72.png       Android status-bar badge — white silhouette on
 *                                           transparent, monochrome by spec
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PY = String.raw`
import os
from PIL import Image

ROOT = os.environ["NUMU_ROOT"]
SRC  = os.path.join(ROOT, "public", "numu-app-icon.png")
OUT  = os.path.join(ROOT, "public", "pwa")
os.makedirs(OUT, exist_ok=True)

NAVY = (0, 53, 107)
INSET = 2  # strips the measured 1px antialiased corner ring

src = Image.open(SRC).convert("RGBA")
w, h = src.size
tile = src.crop((INSET, INSET, w - INSET, h - INSET)).resize((1024, 1024), Image.LANCZOS)

# --- purpose "any": the tile as-is, flattened onto navy so no alpha ships ---
for size in (192, 512):
    canvas = Image.new("RGB", (1024, 1024), NAVY)
    canvas.paste(tile, (0, 0), tile)
    canvas.resize((size, size), Image.LANCZOS).save(
        os.path.join(OUT, f"icon-{size}.png"), optimize=True
    )

# --- maskable ---
# Measured 2026-08-08: the source art's mark already sits at 190px from centre
# versus the 205px safe radius, i.e. it ALREADY respects the maskable safe zone
# with margin. So the maskable is just the flattened tile — which also keeps the
# brand diamond pattern. Rebuilding the mark to fill the circle put its corners
# at exactly 205px (zero margin), which is fragile for no visual gain.
flat = Image.new("RGB", (1024, 1024), NAVY)
flat.paste(tile, (0, 0), tile)
flat.resize((512, 512), Image.LANCZOS).save(
    os.path.join(OUT, "maskable-512.png"), optimize=True
)

# Locate the mark once, for the badge below and for the safe-zone report.
px = flat.load()
minx, miny, maxx, maxy = 1024, 1024, 0, 0
for y in range(1024):
    for x in range(1024):
        r, g, b = px[x, y]
        if (r + g + b) / 3 > 110:          # cream mark + saffron wordmark only
            minx = min(minx, x); maxx = max(maxx, x)
            miny = min(miny, y); maxy = max(maxy, y)

mark = flat.crop((minx, miny, maxx + 1, maxy + 1))
mw, mh = mark.size

# --- badge: monochrome white silhouette on transparent ---
badge = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
mpx = mark.convert("RGB").load()
bpx = badge.load()
ox, oy = (1024 - mw) // 2, (1024 - mh) // 2
for y in range(mh):
    for x in range(mw):
        r, g, b = mpx[x, y]
        if (r + g + b) / 3 > 110:
            bpx[ox + x, oy + y] = (255, 255, 255, 255)
badge.resize((72, 72), Image.LANCZOS).save(os.path.join(OUT, "badge-72.png"), optimize=True)

# --- report ---
for f in ("icon-192.png", "icon-512.png", "maskable-512.png", "badge-72.png"):
    p = os.path.join(OUT, f)
    print(f"  {f:<18}{os.path.getsize(p):>7} B  {Image.open(p).size}  {Image.open(p).mode}")

import math
cx = cy = 512.0
worst = max(math.hypot(x - cx, y - cy)
            for x, y in [(minx, miny), (maxx, miny), (minx, maxy), (maxx, maxy)])
safe = 0.4 * 1024
print(f"  mark bbox in source: x {minx}-{maxx}  y {miny}-{maxy}")
print(f"  maskable safe zone: furthest mark corner {worst:.0f}px vs safe radius {safe:.0f}px "
      f"-> {'SAFE' if worst < safe else 'CLIPS'} ({100 * (1 - worst / safe):.0f}% margin)")
`;

console.log("Generating PWA icons from public/numu-app-icon.png ...");
const out = execFileSync("python", ["-c", PY], {
  env: { ...process.env, NUMU_ROOT: root, PYTHONIOENCODING: "utf-8" },
  encoding: "utf-8",
});
console.log(out.trimEnd());
console.log("Done. Verify maskable-512.png at https://maskable.app before shipping.");
