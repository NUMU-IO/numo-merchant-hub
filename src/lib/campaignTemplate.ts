/**
 * Client-side email body generator for marketing campaigns.
 *
 * Renders a Vionne-flavored RTL email template populated from a selected
 * promoted item (product / collection / page). Lives in the hub for now
 * because the backend `promoted_item` field isn't shipped yet — once it
 * is, the same rendering moves server-side and this module becomes a
 * pure preview helper for the dialog (`/marketing/templates/preview`).
 *
 * Design intent:
 *   - One template, parameterized. Not a builder. Merchants who want
 *     pixel control still edit the generated HTML freely afterward.
 *   - All visual styling inlined (email clients strip <style> tags).
 *   - Arabic-first (`dir="rtl"`, Cairo font) since the storefront's
 *     primary locale is `ar`; switches to LTR + system stack when
 *     `isAr` is false.
 *   - Hero image, headline, body copy, single CTA button. Footer with
 *     the store name.
 */

export type PromotedKind = "product" | "collection" | "page";

export interface PromotedProductSnapshot {
  kind: "product";
  product_id: string;
  name: string;
  image_url: string | null;
  price: string | null;
  currency: string | null;
  url: string;
}

export interface PromotedCollectionSnapshot {
  kind: "collection";
  collection_slug: string;
  name: string;
  image_url: string | null;
  url: string;
}

export interface PromotedPageSnapshot {
  kind: "page";
  page_path: string; // "/", "/products", "/about", etc.
  name: string; // Human label: "Home", "All products", etc.
  url: string;
}

export type PromotedSnapshot =
  | PromotedProductSnapshot
  | PromotedCollectionSnapshot
  | PromotedPageSnapshot;

interface TemplateOptions {
  storeName: string;
  isAr: boolean;
  /** Optional promo headline overriding the default ("New from {store}"). */
  headline?: string;
  /** Optional CTA label override. */
  ctaLabel?: string;
}

const DEFAULT_HERO =
  "https://placehold.co/1200x630/f6f4ef/111?text=NUMU";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeUrl(value: string): string {
  // Only allow http/https. Reject anything starting with javascript:, data:,
  // file:, etc. so a malicious snapshot URL can't slip into mailto-able HTML.
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "#";
    return escapeHtml(u.toString());
  } catch {
    return "#";
  }
}

export function buildEmailBody(
  snapshot: PromotedSnapshot,
  opts: TemplateOptions,
): string {
  const { storeName, isAr } = opts;
  const dir = isAr ? "rtl" : "ltr";
  const lang = isAr ? "ar" : "en";

  const name = escapeHtml(snapshot.name);
  const ctaUrl = escapeUrl(snapshot.url);
  const image = escapeUrl(
    "image_url" in snapshot && snapshot.image_url
      ? snapshot.image_url
      : DEFAULT_HERO,
  );

  const headline =
    opts.headline?.trim() ||
    (snapshot.kind === "product"
      ? isAr
        ? `جديد من ${escapeHtml(storeName)}`
        : `New from ${escapeHtml(storeName)}`
      : snapshot.kind === "collection"
        ? isAr
          ? `استكشف ${name}`
          : `Explore ${name}`
        : isAr
          ? storeName
          : escapeHtml(storeName));

  const subhead =
    snapshot.kind === "product"
      ? name
      : snapshot.kind === "collection"
        ? isAr
          ? "تشكيلة جديدة في انتظارك"
          : "A fresh collection awaits"
        : isAr
          ? "زورنا الآن"
          : "Come take a look";

  const priceLine =
    snapshot.kind === "product" && snapshot.price
      ? `<p style="margin:0 0 16px;font-size:18px;color:#111;font-weight:600">${escapeHtml(snapshot.price)} ${escapeHtml(snapshot.currency || "EGP")}</p>`
      : "";

  const ctaLabel = escapeHtml(
    opts.ctaLabel?.trim() ||
      (snapshot.kind === "product"
        ? isAr
          ? "اشتري الآن"
          : "Shop now"
        : snapshot.kind === "collection"
          ? isAr
            ? "تصفح المجموعة"
            : "Browse the collection"
          : isAr
            ? "اكتشف المزيد"
            : "Learn more"),
  );

  return `<!doctype html>
<html dir="${dir}" lang="${lang}">
<body style="margin:0;padding:0;font-family:Cairo,Helvetica,Arial,sans-serif;background:#f6f4ef;color:#222">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4ef">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e9e4dc">
        <tr><td style="padding:36px 32px 8px;text-align:center">
          <h1 style="margin:0 0 8px;font-size:28px;color:#111;letter-spacing:-0.5px">${headline}</h1>
          <p style="margin:0;font-size:14px;color:#666">${subhead}</p>
        </td></tr>
        <tr><td style="padding:24px 32px">
          <img src="${image}" alt="${name}" width="100%" style="display:block;border-radius:6px"/>
        </td></tr>
        <tr><td style="padding:8px 32px 24px;text-align:center">
          ${priceLine}
          <a href="${ctaUrl}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:14px 40px;border-radius:4px;font-size:14px;font-weight:600;letter-spacing:0.5px">${ctaLabel}</a>
        </td></tr>
        <tr><td style="padding:24px 32px;border-top:1px solid #e9e4dc;text-align:center">
          <p style="margin:0;font-size:12px;color:#999">${escapeHtml(storeName)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/** Subject suggestion based on the promoted item — merchant can override. */
export function suggestSubject(
  snapshot: PromotedSnapshot,
  storeName: string,
  isAr: boolean,
): string {
  if (snapshot.kind === "product") {
    return isAr
      ? `${snapshot.name} — ${storeName}`
      : `${snapshot.name} — ${storeName}`;
  }
  if (snapshot.kind === "collection") {
    return isAr
      ? `استكشف ${snapshot.name}`
      : `Explore ${snapshot.name}`;
  }
  return storeName;
}
