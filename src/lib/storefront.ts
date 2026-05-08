/**
 * Storefront URL helpers.
 *
 * Uses VITE_STOREFRONT_URL — a URL template with a {subdomain} placeholder.
 *   Dev:  "http://{subdomain}.localhost:3000"
 *   Prod: "https://{subdomain}.numueg.app"
 *
 * The default points at port 3000 because numu-egyptian-bazaar has been
 * migrated to Next.js (`next dev --turbopack`). The legacy Vite build on
 * port 8081 is still available via `bun run dev:vite` but isn't the
 * primary dev surface anymore — devs running it can override the port
 * via VITE_STOREFRONT_URL in .env.local.
 */

const STOREFRONT_URL_TEMPLATE =
  import.meta.env.VITE_STOREFRONT_URL || "http://{subdomain}.localhost:3000";

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
