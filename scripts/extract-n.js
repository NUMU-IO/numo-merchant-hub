// One-off: extract the cream N from numu-n-mark.jpg (cream-on-navy)
// into a transparent PNG. The N is the bright/cream pixels; the navy
// background needs to become alpha=0. We threshold on luminance: any
// pixel close to the brand navy gets fully transparent, the rest
// keeps its color and stays opaque. Output: navy-transparent N mark.
const path = require("path");
const sharp = require(path.join("c:/Users/Yahia/NUMU/numo-merchant-hub/node_modules/sharp"));

const SRC = "c:/Users/Yahia/NUMU/numo-merchant-hub/public/numu-n-mark.jpg";
const OUT = "c:/Users/Yahia/NUMU/numo-merchant-hub/public/numu-n-mark-transparent.png";

(async () => {
  const img = sharp(SRC);
  const { width, height } = await img.metadata();
  const raw = await img.ensureAlpha().raw().toBuffer();

  // Navy bg ≈ rgb(13, 50, 95). Cream N ≈ rgb(238, 232, 220). The
  // stars in the corners are a slightly lighter navy (rgb ~ 30 60 100).
  // Threshold on the channel sum: anything < 380 is "dark / navy /
  // star" -> alpha 0. Anything else (the cream N) stays opaque, and
  // we re-color it white so the watermark reads as a soft white shape
  // on whatever background it's painted over.
  const out = Buffer.alloc(raw.length);
  for (let i = 0; i < raw.length; i += 4) {
    const r = raw[i], g = raw[i + 1], b = raw[i + 2];
    const lum = r + g + b;
    if (lum < 380) {
      // Navy / star -> transparent
      out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; out[i + 3] = 0;
    } else {
      // Cream N -> white, opaque (soft anti-aliased edge via the
      // original brightness as alpha, so the shape doesn't get a
      // pixelated stair-step on diagonal cuts).
      const alpha = Math.min(255, Math.max(0, Math.round((lum - 380) * 1.5)));
      out[i] = 255; out[i + 1] = 255; out[i + 2] = 255; out[i + 3] = alpha;
    }
  }

  await sharp(out, { raw: { width, height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(OUT);
  console.log("wrote", OUT);
})();
