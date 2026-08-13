/**
 * Client-side image compression for camera-captured product photos.
 *
 * A modern phone camera produces 4–8 MB JPEGs. Uploading those raw over
 * Egyptian mobile data is slow enough that merchants abandon the product form
 * — and the storefront never displays them above ~1600px anyway, so the extra
 * bytes buy nothing.
 *
 * Deliberately conservative: images already under the threshold are returned
 * UNTOUCHED. Silently re-encoding a file the merchant carefully prepared would
 * be worse than shipping it as-is.
 */

/** Above this, the storefront gains nothing from more pixels. */
const MAX_DIMENSION = 1600;
/** Files under this are passed through — not worth a re-encode. */
const SKIP_BELOW_BYTES = 600 * 1024;
const QUALITY = 0.82;

export interface CompressResult {
  file: File;
  originalBytes: number;
  finalBytes: number;
  compressed: boolean;
}

export async function compressImage(file: File): Promise<CompressResult> {
  const originalBytes = file.size;

  const passthrough = (): CompressResult => ({
    file,
    originalBytes,
    finalBytes: originalBytes,
    compressed: false,
  });

  // PNG/SVG can carry transparency or be vector; re-encoding to JPEG would
  // destroy it. Only touch photographic input.
  if (!/^image\/(jpe?g|webp)$/i.test(file.type)) return passthrough();
  if (originalBytes < SKIP_BELOW_BYTES) return passthrough();

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return passthrough();
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );
    if (!blob) return passthrough();

    // If compression didn't actually help, keep the original — re-encoding a
    // already-optimised image only loses quality.
    if (blob.size >= originalBytes) return passthrough();

    const name = file.name.replace(/\.(png|webp|jpeg)$/i, ".jpg");
    return {
      file: new File([blob], name, { type: "image/jpeg", lastModified: Date.now() }),
      originalBytes,
      finalBytes: blob.size,
      compressed: true,
    };
  } catch {
    // createImageBitmap/canvas unsupported or the file is corrupt — uploading
    // the original is always better than failing the upload.
    return passthrough();
  }
}
