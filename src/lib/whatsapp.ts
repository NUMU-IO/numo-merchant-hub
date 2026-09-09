/**
 * WhatsApp deep links — the Tier 3 courier handoff (P9, lite).
 *
 * Cathedis, البريد المصري branch reps and the rider on a motorbike all
 * work over WhatsApp. The full two-way flow needs approved Meta
 * templates and weeks of lead time; a `wa.me` link needs neither, and
 * covers the part merchants do by hand today: telling the courier there
 * are parcels waiting.
 */

import { AR_PARCELS, countAr, pluralAr } from "./arabic-plural";

/**
 * A phone number as `wa.me` wants it: international digits, no `+`.
 *
 * Merchants type Egyptian numbers every way there is — `01098433918`,
 * `+20 109 843 3918`, `0020109…`. Returns null when there aren't enough
 * digits to be a real number, so the caller can hide the button rather
 * than open WhatsApp on nothing.
 */
export function toWhatsAppDigits(phone: string | null | undefined): string | null {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;

  // 00 is the old international prefix — wa.me wants neither it nor +.
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("20")) {
    // Already Egyptian international.
  } else if (digits.startsWith("0")) {
    // Local form: 01098433918 → 201098433918.
    digits = `20${digits.slice(1)}`;
  } else if (digits.length === 10 && digits.startsWith("1")) {
    // Local form with the leading zero dropped.
    digits = `20${digits}`;
  }
  // Anything else is assumed to already carry its own country code.

  return digits.length >= 10 ? digits : null;
}

/** `wa.me` link with a pre-filled message, or null if the number is unusable. */
export function whatsAppLink(
  phone: string | null | undefined,
  text: string,
): string | null {
  const digits = toWhatsAppDigits(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

/**
 * The pickup request itself.
 *
 * Deliberately carries no COD total. The only figure the hub holds is
 * store-wide `cod_pending`, which counts parcels already out with other
 * couriers — quoting it here would tell this courier to expect cash that
 * isn't in the bag. The manifest carries the real per-parcel amounts.
 */
export function pickupMessage(opts: {
  courier: string;
  store: string;
  parcels: number;
  cutoff?: string | null;
  isAr: boolean;
}): string {
  const { courier, store, parcels, cutoff, isAr } = opts;

  if (isAr) {
    // One and two are carried by the noun form itself — "١ شحنة" is wrong
    // the way "1 parcel" is right. Same rule as `agoAr`.
    const count =
      parcels === 1 || parcels === 2
        ? pluralAr(parcels, AR_PARCELS)
        : countAr(parcels, AR_PARCELS);
    const lines = [`أهلاً ${courier} 👋`, `عندنا ${count} للاستلام من ${store}.`];
    if (cutoff) lines.push(`محتاجين حد يعدّي قبل ${cutoff}.`);
    lines.push("الكشف جاهز معانا.");
    return lines.join("\n");
  }

  const lines = [
    `Hi ${courier} 👋`,
    `We have ${parcels} parcel${parcels === 1 ? "" : "s"} ready for pickup from ${store}.`,
  ];
  if (cutoff) lines.push(`Could someone come before ${cutoff}?`);
  lines.push("The manifest is ready for you here.");
  return lines.join("\n");
}
