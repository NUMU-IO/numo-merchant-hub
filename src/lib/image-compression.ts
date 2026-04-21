/**
 * Client-side image compression for uploads.
 *
 * A phone photo can easily be 8–15 MB. The server accepts up to 5 MB, and
 * it regenerates 150/600/1200 px WebP variants anyway, so sending the raw
 * original is wasteful and frequently hits the size limit. We downscale
 * and re-encode in the browser before handing the file to the upload
 * validator, so the merchant never sees a "too large" error for a normal
 * phone photo.
 *
 * We deliberately skip the re-encode when the file is already small —
 * re-encoding a 300 KB WebP into a new WebP only loses quality.
 */

export interface CompressOptions {
  /** Longest-edge pixel cap. Server makes 1200/600/150 variants, so 2048 is generous. */
  maxDimension?: number;
  /** Target output size in bytes. Quality is reduced iteratively to hit this. */
  maxBytes?: number;
  /** Output MIME — defaults to WebP; falls back to JPEG when WebP encoding fails. */
  mimeType?: "image/webp" | "image/jpeg";
  /** Starting JPEG/WebP quality (0..1). */
  quality?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 2048,
  maxBytes: 1.5 * 1024 * 1024, // 1.5 MB — well under the 5 MB cap, keeps uploads fast
  mimeType: "image/webp",
  quality: 0.85,
};

/**
 * Returns a compressed File if compression was needed, or the original
 * File if it was already within limits. Never throws for bitmap decode
 * failures — returns the original so the upload flow can continue and
 * the size/type validator can produce a clean user-facing error.
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<File> {
  const o = { ...DEFAULTS, ...opts };

  // Skip compression for already-small files — re-encoding costs quality.
  // Also skip SVG / GIF / anything non-raster we don't handle.
  const isRaster = /^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type);
  if (!isRaster) return file;

  // Read natural dimensions first. If the file is small AND within bounds,
  // there's nothing useful to do.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  const { width, height } = bitmap;
  const longest = Math.max(width, height);
  const withinBytes = file.size <= o.maxBytes;
  const withinDims = longest <= o.maxDimension;
  if (withinBytes && withinDims) {
    bitmap.close?.();
    return file;
  }

  const scale = longest > o.maxDimension ? o.maxDimension / longest : 1;
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    return file;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  // Try the preferred format; fall back to JPEG if the browser won't encode WebP.
  let blob = await canvasToBlob(canvas, o.mimeType, o.quality);
  if (!blob && o.mimeType !== "image/jpeg") {
    blob = await canvasToBlob(canvas, "image/jpeg", o.quality);
  }
  if (!blob) return file;

  // If still too big, step quality down. 5 tries is plenty — by 0.4 quality
  // a 12 MP photo is comfortably under 1 MB.
  let quality = o.quality;
  for (let i = 0; i < 5 && blob.size > o.maxBytes && quality > 0.4; i++) {
    quality -= 0.1;
    const next = await canvasToBlob(canvas, blob.type as "image/webp" | "image/jpeg", quality);
    if (!next) break;
    blob = next;
  }

  // Preserve the original basename, swap the extension to match output.
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.${ext}`, { type: blob.type, lastModified: Date.now() });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/jpeg",
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}
