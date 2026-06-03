/**
 * Structured API error with status code, server detail, and user-friendly messages.
 * Thrown by apiClient / authApi so components get rich error context.
 */

// ─── Error class ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  /** HTTP status code (0 = network / timeout) */
  status: number;
  /** Raw detail string from the server body, if any */
  serverDetail: string | null;
  /** Parsed field-level validation errors (422) */
  fieldErrors: Record<string, string> | null;
  /** Raw parsed response body, if any. Carries structured error payloads the
   *  flat `serverDetail` string can't represent — e.g. the 409 stale-etag
   *  conflict `{ detail: { current_etag, current_draft } }`. */
  body: unknown;

  constructor(
    status: number,
    serverDetail: string | null,
    fieldErrors?: Record<string, string> | null,
    body?: unknown,
  ) {
    const msg = serverDetail || statusToMessage(status, "en");
    super(msg);
    this.name = "ApiError";
    this.status = status;
    this.serverDetail = serverDetail;
    this.fieldErrors = fieldErrors ?? null;
    this.body = body ?? null;
  }

  /** Get a user-friendly message in the given language */
  toUserMessage(lang: string = "en"): string {
    const isAr = lang === "ar";

    // Network error
    if (this.status === 0) {
      return isAr
        ? "لا يوجد اتصال بالإنترنت. تحقق من الشبكة وحاول مرة أخرى."
        : "No internet connection. Check your network and try again.";
    }

    // If the server gave a meaningful detail, use it (unless it's a generic code)
    if (this.serverDetail && !this.serverDetail.startsWith("API error:")) {
      return translateServerDetail(this.serverDetail, isAr);
    }

    return statusToMessage(this.status, lang);
  }
}

// ─── Status → human message ──────────────────────────────────────────────────

function statusToMessage(status: number, lang: string): string {
  const isAr = lang === "ar";
  const map: Record<number, [string, string]> = {
    0:   ["No internet connection. Check your network and try again.",
          "لا يوجد اتصال بالإنترنت. تحقق من الشبكة وحاول مرة أخرى."],
    400: ["Invalid request. Please check your input and try again.",
          "طلب غير صالح. تحقق من البيانات وحاول مرة أخرى."],
    401: ["Your session has expired. Please log in again.",
          "انتهت جلستك. يرجى تسجيل الدخول مرة أخرى."],
    403: ["You don't have permission to perform this action.",
          "ليس لديك صلاحية لتنفيذ هذا الإجراء."],
    404: ["The requested item was not found.",
          "العنصر المطلوب غير موجود."],
    409: ["This conflicts with existing data. It may already exist.",
          "يوجد تعارض مع بيانات حالية. ربما يكون موجوداً بالفعل."],
    413: ["The file is too large. Please use a smaller file.",
          "الملف كبير جداً. يرجى استخدام ملف أصغر."],
    422: ["Some fields are invalid. Please review and correct them.",
          "بعض الحقول غير صالحة. يرجى مراجعتها وتصحيحها."],
    429: ["Too many requests. Please wait a moment and try again.",
          "طلبات كثيرة جداً. انتظر لحظة وحاول مرة أخرى."],
    500: ["Something went wrong on our end. Please try again later.",
          "حدث خطأ في الخادم. حاول مرة أخرى لاحقاً."],
    502: ["Server is temporarily unavailable. Please try again.",
          "الخادم غير متاح مؤقتاً. حاول مرة أخرى."],
    503: ["Service is under maintenance. Please try again later.",
          "الخدمة تحت الصيانة. حاول مرة أخرى لاحقاً."],
  };

  const pair = map[status];
  if (pair) return isAr ? pair[1] : pair[0];

  if (status >= 500) {
    return isAr
      ? "حدث خطأ في الخادم. حاول مرة أخرى لاحقاً."
      : "Something went wrong on our end. Please try again later.";
  }
  return isAr ? "حدث خطأ غير متوقع." : "An unexpected error occurred.";
}

// ─── Translate common server detail strings ──────────────────────────────────

const SERVER_DETAIL_MAP: Array<[RegExp, string, string]> = [
  // Auth
  [/invalid credentials/i, "Invalid email or password.", "البريد الإلكتروني أو كلمة المرور غير صحيحة."],
  [/email already registered/i, "This email is already registered.", "هذا البريد الإلكتروني مسجل بالفعل."],
  [/email.*already.*exists/i, "This email is already registered.", "هذا البريد الإلكتروني مسجل بالفعل."],
  [/account.*locked/i, "Account temporarily locked. Try again later.", "تم قفل الحساب مؤقتاً. حاول لاحقاً."],
  [/account.*disabled/i, "This account has been disabled.", "تم تعطيل هذا الحساب."],
  [/account.*not.*verified/i, "Please verify your email first.", "يرجى تأكيد بريدك الإلكتروني أولاً."],
  [/incorrect.*password/i, "Current password is incorrect.", "كلمة المرور الحالية غير صحيحة."],
  [/password.*too.*short/i, "Password must be at least 8 characters.", "كلمة المرور يجب أن تكون 8 أحرف على الأقل."],
  [/token.*expired/i, "Link has expired. Please request a new one.", "انتهت صلاحية الرابط. يرجى طلب رابط جديد."],
  [/invalid.*token/i, "Invalid or expired link.", "رابط غير صالح أو منتهي الصلاحية."],
  [/invalid.*code/i, "Invalid verification code.", "رمز التحقق غير صحيح."],
  [/2fa.*invalid/i, "Invalid 2FA code. Try again.", "رمز التحقق غير صحيح. حاول مرة أخرى."],

  // Store
  [/beta.*invite.*code.*required/i, "A beta invite code is required to create a store.", "كود الدعوة مطلوب لإنشاء متجر خلال فترة البيتا."],
  [/invalid.*beta.*code/i, "Invalid beta invite code.", "كود الدعوة غير صحيح."],
  [/beta.*code.*expired/i, "This beta code has expired.", "انتهت صلاحية كود الدعوة."],
  [/beta.*code.*used/i, "This beta code has already been used.", "كود الدعوة مُستخدم بالفعل."],
  [/subdomain.*taken/i, "This subdomain is already taken.", "هذا النطاق الفرعي مأخوذ بالفعل."],
  [/subdomain.*invalid/i, "Invalid subdomain format.", "صيغة النطاق الفرعي غير صالحة."],
  [/store.*not.*found/i, "Store not found.", "المتجر غير موجود."],

  // Products
  [/product.*not.*found/i, "Product not found.", "المنتج غير موجود."],
  [/sku.*already.*exists/i, "This SKU already exists.", "رمز المنتج (SKU) موجود بالفعل."],
  [/slug.*already.*exists/i, "This URL slug is already in use.", "رابط المنتج مستخدم بالفعل."],
  [/insufficient.*stock/i, "Insufficient stock for this operation.", "المخزون غير كافٍ لهذه العملية."],

  // Orders
  [/cannot.*transition/i, "This status transition is not allowed.", "لا يمكن تغيير الحالة بهذه الطريقة."],
  [/order.*not.*found/i, "Order not found.", "الطلب غير موجود."],
  [/already.*refunded/i, "This order has already been refunded.", "تم استرداد هذا الطلب بالفعل."],
  [/refund.*exceeds/i, "Refund amount exceeds the order total.", "مبلغ الاسترداد يتجاوز إجمالي الطلب."],

  // Categories
  [/category.*not.*found/i, "Category not found.", "الفئة غير موجودة."],
  [/category.*has.*products/i, "Can't delete: category has products.", "لا يمكن الحذف: الفئة تحتوي على منتجات."],

  // Coupons
  [/coupon.*not.*found/i, "Coupon not found.", "القسيمة غير موجودة."],
  [/coupon.*code.*exists/i, "This coupon code already exists.", "كود القسيمة موجود بالفعل."],
  [/coupon.*expired/i, "This coupon has expired.", "انتهت صلاحية هذه القسيمة."],

  // File upload
  [/file.*too.*large/i, "File is too large.", "الملف كبير جداً."],
  [/unsupported.*file/i, "Unsupported file type.", "نوع الملف غير مدعوم."],
  [/upload.*failed/i, "File upload failed. Try again.", "فشل رفع الملف. حاول مرة أخرى."],

  // Rate limiting
  [/rate.*limit/i, "Too many attempts. Please wait and try again.", "محاولات كثيرة. انتظر قليلاً وحاول مرة أخرى."],
  [/too.*many.*requests/i, "Too many requests. Please slow down.", "طلبات كثيرة جداً. حاول بعد قليل."],

  // CSRF
  [/csrf.*validation/i, "Session security error. Please refresh the page.", "خطأ في أمان الجلسة. يرجى تحديث الصفحة."],

  // Generic
  [/not.*found/i, "The requested item was not found.", "العنصر المطلوب غير موجود."],
  [/already.*exists/i, "This item already exists.", "هذا العنصر موجود بالفعل."],
  [/permission.*denied/i, "You don't have permission for this action.", "ليس لديك صلاحية لهذا الإجراء."],
  [/forbidden/i, "You don't have permission for this action.", "ليس لديك صلاحية لهذا الإجراء."],
];

function translateServerDetail(detail: string, isAr: boolean): string {
  for (const [pattern, en, ar] of SERVER_DETAIL_MAP) {
    if (pattern.test(detail)) {
      return isAr ? ar : en;
    }
  }
  // If no pattern matches, return the raw detail (likely already English)
  // For Arabic, wrap with a generic prefix
  if (isAr) {
    return `خطأ: ${detail}`;
  }
  return detail;
}

// ─── Parse 422 validation detail ─────────────────────────────────────────────

/**
 * FastAPI 422 errors come as:
 *   { detail: [{ loc: ["body", "field"], msg: "error", type: "..." }, ...] }
 * or sometimes as:
 *   { detail: "string message" }
 */
export function parse422Detail(
  body: unknown,
): { message: string; fields: Record<string, string> } | null {
  if (!body || typeof body !== "object") return null;

  const detail = (body as Record<string, unknown>).detail;

  // Array of validation errors (FastAPI format)
  if (Array.isArray(detail)) {
    const fields: Record<string, string> = {};
    for (const err of detail) {
      if (err && typeof err === "object" && "loc" in err && "msg" in err) {
        const loc = (err as { loc: string[]; msg: string }).loc;
        const msg = (err as { loc: string[]; msg: string }).msg;
        // Skip "body" prefix in loc path
        const key = loc.filter((l) => l !== "body").join(".");
        if (key) fields[key] = msg;
      }
    }
    const message = Object.values(fields).join(". ");
    return { message, fields };
  }

  // String detail
  if (typeof detail === "string") {
    return { message: detail, fields: {} };
  }

  return null;
}

// ─── Helper to build ApiError from a fetch Response ──────────────────────────

export async function apiErrorFromResponse(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => null);

  // Handle 422 specially — parse field-level errors
  if (res.status === 422 && body) {
    const parsed = parse422Detail(body);
    if (parsed) {
      return new ApiError(res.status, parsed.message, parsed.fields, body);
    }
  }

  // Extract detail from various API response formats:
  //   FastAPI standard:  { detail: "..." } or { detail: [{loc, msg}] }
  //   NUMU custom:       { error: { message: "...", code: "..." } }
  //   Generic:           { message: "..." }
  const detail = body?.detail;
  const detailStr =
    typeof detail === "string"
      ? detail
      : Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d?.msg).filter(Boolean).join(". ")
        : typeof body?.error?.message === "string"
          ? body.error.message
          : typeof body?.message === "string"
            ? body.message
            : null;

  return new ApiError(res.status, detailStr, null, body);
}

// ─── Network error helper ────────────────────────────────────────────────────

export function apiErrorFromNetwork(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  if (err instanceof TypeError && err.message.includes("fetch")) {
    return new ApiError(0, null);
  }
  return new ApiError(0, err instanceof Error ? err.message : null);
}
