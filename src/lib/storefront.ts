/**
 * Storefront URL helpers.
 *
 * Uses VITE_STOREFRONT_URL — a URL template with a {subdomain} placeholder.
 *   Dev:  "http://{subdomain}.localhost:8081"
 *   Prod: "https://{subdomain}.numueg.app"
 */

const STOREFRONT_URL_TEMPLATE =
  import.meta.env.VITE_STOREFRONT_URL || "http://{subdomain}.localhost:8081";

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
