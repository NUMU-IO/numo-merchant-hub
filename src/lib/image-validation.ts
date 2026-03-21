/**
 * Shared image validation utilities for file uploads.
 */

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Validates file content by checking magic bytes (first 12 bytes).
 * Detects JPEG, PNG, and WebP regardless of file extension.
 */
export async function validateImageMagicBytes(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // JPEG: FF D8 FF
  const isJPEG = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;

  // PNG: 89 50 4E 47
  const isPNG =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;

  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  const isWebP =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  return isJPEG || isPNG || isWebP;
}

/**
 * Full image validation: size, MIME type, and magic bytes.
 * Returns an error message string or null if valid.
 */
export async function validateImageFile(file: File): Promise<string | null> {
  if (file.size > MAX_FILE_SIZE) {
    return "حجم الصورة يجب أن لا يتجاوز 5 ميجابايت";
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return "نوع الملف غير مدعوم. يرجى رفع صورة بصيغة JPG أو PNG أو WebP فقط";
  }

  const isValid = await validateImageMagicBytes(file);
  if (!isValid) {
    return "نوع الملف غير مدعوم. يرجى رفع صورة بصيغة JPG أو PNG أو WebP فقط";
  }

  return null;
}
