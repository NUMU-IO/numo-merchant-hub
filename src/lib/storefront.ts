/**
 * Storefront URL helpers.
 *
 * URL template with a {subdomain} placeholder. Resolution order:
 *   1. VITE_V3_STOREFRONT_URL — the V3 storefront (numu-storefront), when the
 *      env has one (test → "https://{subdomain}.v3.test.numueg.app"). This is
 *      the same var the theme preview uses, so "Visit store" and the preview
 *      always point at the SAME storefront.
 *   2. VITE_STOREFRONT_URL — legacy bazaar storefront fallback
 *      (prod → "https://{subdomain}.numueg.app").
 *   3. Local dev default.
 *
 * Keeping V3 first makes the V3 storefront the single main store everywhere
 * it's configured; envs without a V3 storefront (V3 var unset) fall back to
 * the bazaar URL with no behavior change.
 */

const STOREFRONT_URL_TEMPLATE =
  import.meta.env.VITE_V3_STOREFRONT_URL ||
  import.meta.env.VITE_STOREFRONT_URL ||
  "http://{subdomain}.localhost:3000";

/** Build the full storefront URL for a given subdomain. */
export function getStoreUrl(subdomain: string): string {
  return STOREFRONT_URL_TEMPLATE.replace("{subdomain}", subdomain);
}

/**
 * Domain suffix shown next to the subdomain input field.
 * Extracts everything after {subdomain} in the template.
 *   "https://{subdomain}.numueg.app"     → ".numueg.app"
 *   "http://{subdomain}.localhost:8081"   → ".localhost:8081"
 */
export function getStoreDomainSuffix(): string | null {
  const after = STOREFRONT_URL_TEMPLATE.split("{subdomain}")[1];
  return after || null;
}

/* ─── Custom domains ────────────────────────────────────────────────────────
 * Once a merchant connects their own domain and Cloudflare issues the cert,
 * THAT domain is the store — it's what the storefront sets as `canonical`,
 * what Meta/TikTok feeds emit, and what shoppers see. Everything in the hub
 * that opens/shares/displays the live store must follow it instead of the
 * `<subdomain>.numueg.app` fallback, or a merchant who paid for a domain
 * keeps being handed the NUMU URL.
 *
 * Preview/editor plumbing (theme preview iframes, promotion preview tokens)
 * deliberately stays on the canonical subdomain — see the call sites.
 */

/** The subset of `StoreData` these helpers need (keeps them import-free). */
export interface StoreUrlSource {
  subdomain?: string | null;
  custom_domain?: string | null;
  settings?: Record<string, unknown> | null;
}

/** Lifecycle block the backend persists at `settings.custom_domain`. */
interface CustomDomainSettings {
  hostname?: string;
  status?: string;
}

/** Strip scheme/path/case off a stored hostname. */
function normalizeHost(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

/**
 * The merchant's own domain — but only once it actually serves the store.
 *
 * `store.custom_domain` is written the moment the merchant clicks Connect,
 * long before they've added the CNAME, so it alone is not proof the domain
 * resolves. The backend tracks the real lifecycle in
 * `settings.custom_domain.status` (pending_dns → verifying → active), and we
 * only switch over on `active`. Domains provisioned out-of-band (no lifecycle
 * block at all) are trusted as-is — they predate the Cloudflare flow.
 */
export function getActiveCustomDomain(
  store: StoreUrlSource | null | undefined,
): string | null {
  if (!store?.custom_domain) return null;
  const host = normalizeHost(store.custom_domain);
  if (!host) return null;

  const block = (
    store.settings as { custom_domain?: CustomDomainSettings } | null | undefined
  )?.custom_domain;
  if (!block || typeof block !== "object") return host;

  return String(block.status ?? "").toLowerCase() === "active" ? host : null;
}

/**
 * The store's public URL: the live custom domain when there is one, else the
 * env-aware `<subdomain>` storefront URL. Returns null for a store with
 * neither (shouldn't happen — guard anyway).
 */
export function getPublicStoreUrl(
  store: StoreUrlSource | null | undefined,
): string | null {
  const domain = getActiveCustomDomain(store);
  if (domain) return `https://${domain}`;
  return store?.subdomain ? getStoreUrl(store.subdomain) : null;
}

/** Same as {@link getPublicStoreUrl} but bare host — for display/chrome bars. */
export function getPublicStoreHost(
  store: StoreUrlSource | null | undefined,
): string | null {
  const url = getPublicStoreUrl(store);
  return url ? normalizeHost(url) : null;
}

/** Join a path onto the store's public URL without doubling the slash. */
export function getPublicStorePath(
  store: StoreUrlSource | null | undefined,
  path: string,
): string | null {
  const base = getPublicStoreUrl(store);
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}
