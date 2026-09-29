/**
 * Answers a merchant gave in the landing page's onboarding chat, carried into
 * the setup wizard.
 *
 * The landing puts them in the token hand-off fragment as `prefill=<json>`.
 * Every hop after that — /verify-email, /, /create-store — drops the query
 * string, so TokenHandoff stores them here and OnboardingWizard reads them
 * once. localStorage rather than sessionStorage: verifying from the email link
 * opens a new tab. They expire after a week and are cleared once the wizard
 * saves.
 *
 * The values come from a URL, so they are untrusted: only ids the wizard
 * actually offers survive `readPrefill`. Nothing personal is ever in here —
 * niche, where they sell, order band, payment methods, shipping.
 */

const KEY = "numu-onboarding-prefill";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RAW = 500;

export interface OnboardingPrefill {
  niche?: string;
  sellsWhere?: string;
  ordersBand?: string;
  payments?: string[];
  shipping?: string;
}

export interface PrefillOptions {
  niche: string[];
  sellsWhere: string[];
  ordersBand: string[];
  payments: string[];
  shipping: string[];
}

/** Keep the raw JSON from the hand-off. Called before anything is validated. */
export function savePrefill(raw: string | null, now = Date.now()): void {
  if (!raw || raw.length > MAX_RAW) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: now, raw }));
  } catch {
    /* storage blocked: the wizard starts empty */
  }
}

/** The stored answers, reduced to options the wizard offers; null if none. */
export function readPrefill(allowed: PrefillOptions, now = Date.now()): OnboardingPrefill | null {
  let answers: Record<string, unknown>;
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!stored || typeof stored.at !== "number" || typeof stored.raw !== "string") return null;
    if (now - stored.at > MAX_AGE_MS) return null;
    answers = JSON.parse(stored.raw);
    if (!answers || typeof answers !== "object") return null;
  } catch {
    return null;
  }

  const one = (value: unknown, options: string[]) =>
    typeof value === "string" && options.includes(value) ? value : undefined;

  const out: OnboardingPrefill = {};
  const niche = one(answers.niche, allowed.niche);
  const sellsWhere = one(answers.sellsWhere, allowed.sellsWhere);
  const ordersBand = one(answers.ordersBand, allowed.ordersBand);
  const shipping = one(answers.shipping, allowed.shipping);
  if (niche) out.niche = niche;
  if (sellsWhere) out.sellsWhere = sellsWhere;
  if (ordersBand) out.ordersBand = ordersBand;
  if (shipping) out.shipping = shipping;
  if (Array.isArray(answers.payments)) {
    const payments = answers.payments.filter(
      (p): p is string => typeof p === "string" && allowed.payments.includes(p),
    );
    if (payments.length) out.payments = Array.from(new Set(payments));
  }
  return Object.keys(out).length ? out : null;
}

export function clearPrefill(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
