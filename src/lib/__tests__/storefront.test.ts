/**
 * Public store URL resolution — a merchant who connected their own domain
 * must be handed THAT domain everywhere the hub opens/shares the live store,
 * but only once Cloudflare has actually certified it.
 */

import { describe, it, expect } from "vitest";
import {
  getActiveCustomDomain,
  getPublicStoreHost,
  getPublicStorePath,
  getPublicStoreUrl,
  getStoreUrl,
} from "../storefront";

const canonical = (subdomain: string) => getStoreUrl(subdomain);

const store = (
  custom_domain: string | null,
  status?: string,
): {
  subdomain: string;
  custom_domain: string | null;
  settings: Record<string, unknown> | null;
} => ({
  subdomain: "vionne",
  custom_domain,
  settings: status ? { custom_domain: { hostname: custom_domain, status } } : null,
});

describe("getActiveCustomDomain", () => {
  it("returns null when no domain is connected", () => {
    expect(getActiveCustomDomain(store(null))).toBeNull();
    expect(getActiveCustomDomain(null)).toBeNull();
    expect(getActiveCustomDomain(undefined)).toBeNull();
  });

  it("returns the domain once the cert is active", () => {
    expect(getActiveCustomDomain(store("vionneeg.com", "active"))).toBe(
      "vionneeg.com",
    );
  });

  it("withholds the domain until it actually serves the store", () => {
    for (const status of ["pending_dns", "verifying", "failed"]) {
      expect(getActiveCustomDomain(store("vionneeg.com", status))).toBeNull();
    }
  });

  it("trusts domains provisioned before the Cloudflare flow (no status block)", () => {
    expect(getActiveCustomDomain(store("vionneeg.com"))).toBe("vionneeg.com");
  });

  it("normalizes a stored scheme/case/trailing slash", () => {
    expect(getActiveCustomDomain(store("HTTPS://VionneEG.com/", "active"))).toBe(
      "vionneeg.com",
    );
  });
});

describe("getPublicStoreUrl", () => {
  it("prefers the live custom domain over the NUMU subdomain", () => {
    expect(getPublicStoreUrl(store("vionneeg.com", "active"))).toBe(
      "https://vionneeg.com",
    );
  });

  it("falls back to the env-aware subdomain URL while the domain is pending", () => {
    expect(getPublicStoreUrl(store("vionneeg.com", "pending_dns"))).toBe(
      canonical("vionne"),
    );
  });

  it("falls back to the subdomain URL when no domain is connected", () => {
    expect(getPublicStoreUrl(store(null))).toBe(canonical("vionne"));
  });

  it("returns null for a store with neither", () => {
    expect(getPublicStoreUrl({ subdomain: null, custom_domain: null })).toBeNull();
  });
});

describe("getPublicStoreHost / getPublicStorePath", () => {
  it("renders the bare host for chrome bars", () => {
    expect(getPublicStoreHost(store("vionneeg.com", "active"))).toBe(
      "vionneeg.com",
    );
  });

  it("joins paths without doubling the slash", () => {
    expect(getPublicStorePath(store("vionneeg.com", "active"), "/pages/about")).toBe(
      "https://vionneeg.com/pages/about",
    );
    expect(getPublicStorePath(store("vionneeg.com", "active"), "product/42")).toBe(
      "https://vionneeg.com/product/42",
    );
  });

  it("returns null when there is no public URL", () => {
    expect(getPublicStorePath({ subdomain: null }, "product/42")).toBeNull();
  });
});
