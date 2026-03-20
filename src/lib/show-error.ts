/**
 * Unified error display helper.
 * Converts any caught error into a user-friendly toast notification.
 */

import { toast } from "sonner";
import { ApiError } from "./api-error";

/**
 * Show a user-friendly error toast from any caught error.
 *
 * Usage:
 *   catch (err) { showError(err, language) }
 *   catch (err) { showError(err, language, "حفظ المنتج", "save product") }
 */
export function showError(
  err: unknown,
  lang: string = "en",
  contextAr?: string,
  contextEn?: string,
): void {
  const isAr = lang === "ar";

  if (err instanceof ApiError) {
    const msg = err.toUserMessage(lang);

    // For 429 (rate limit), use a warning style
    if (err.status === 429) {
      toast.warning(msg);
      return;
    }

    // For 5xx, show with a "try again" feel
    if (err.status >= 500) {
      toast.error(msg, {
        description: isAr ? "حاول مرة أخرى لاحقاً" : "Please try again later",
        duration: 6000,
      });
      return;
    }

    // For 0 (network), show longer duration
    if (err.status === 0) {
      toast.error(msg, { duration: 8000 });
      return;
    }

    toast.error(msg);
    return;
  }

  // Generic Error
  if (err instanceof Error) {
    // Don't show raw "Failed to fetch" — translate it
    if (err.message.includes("fetch") || err.message.includes("network")) {
      toast.error(
        isAr
          ? "لا يوجد اتصال بالإنترنت. تحقق من الشبكة وحاول مرة أخرى."
          : "No internet connection. Check your network and try again.",
        { duration: 8000 },
      );
      return;
    }

    // If there's context, prefix it
    if (contextAr || contextEn) {
      const ctx = isAr ? contextAr : contextEn;
      toast.error(
        isAr ? `فشل ${ctx}` : `Failed to ${ctx}`,
        { description: err.message },
      );
      return;
    }

    toast.error(err.message);
    return;
  }

  // Fallback
  toast.error(isAr ? "حدث خطأ غير متوقع." : "An unexpected error occurred.");
}

/**
 * Convenience: extract field errors from an ApiError for form display.
 * Returns empty object if the error isn't a 422 with field errors.
 */
export function extractFieldErrors(err: unknown): Record<string, string> {
  if (err instanceof ApiError && err.fieldErrors) {
    return err.fieldErrors;
  }
  return {};
}
