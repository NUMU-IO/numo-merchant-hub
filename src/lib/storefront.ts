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
