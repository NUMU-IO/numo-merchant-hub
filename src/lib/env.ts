/**
 * Environment-aware helpers for the merchant-hub.
 *
 * The hub is deployed to three hostnames; each is wired to a different API
 * stack on the same droplet:
 *   - merchant.numueg.app           → apex (prod)
 *   - merchant-test.numueg.app      → test stack (dev branch)
 *   - merchant-staging.numueg.app   → stage stack
 *
 * Storefronts use a flat URL scheme at level 1 of numueg.app
 * (Cloudflare Universal SSL doesn't cover deeper levels):
 *   - prod:   <store>.numueg.app
 *   - test:   <store>-test.numueg.app
 *   - stage:  <store>-staging.numueg.app
 *
 * To keep merchant input clean, the form lets the user type just `<store>`
 * and the env-specific suffix is appended automatically before save.
 */

export type EnvKind = "prod" | "test" | "stage" | "local";

/** Detect which env the merchant-hub is currently running in by hostname. */
export function getEnvKind(): EnvKind {
  if (typeof window === "undefined") return "prod";
  const host = window.location.hostname;
  if (host === "merchant-test.numueg.app") return "test";
  if (host === "merchant-staging.numueg.app") return "stage";
  if (host === "merchant.numueg.app") return "prod";
  return "local";
}

/**
 * Suffix appended to the user-input subdomain before saving + before
 * generating the storefront URL.
 *   prod  → ""
 *   test  → "-test"
 *   stage → "-staging"
 *   local → ""        (storefront stays at <store>.localhost in dev)
 */
export function getStoreSubdomainSuffix(): string {
  switch (getEnvKind()) {
    case "test":
      return "-test";
    case "stage":
      return "-staging";
    default:
      return "";
  }
}

/** Apply the env suffix to a user-input subdomain. */
export function withEnvSuffix(subdomain: string): string {
  return subdomain + getStoreSubdomainSuffix();
}
