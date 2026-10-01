import { describe, expect, it } from "vitest";

import { toStoreSlug } from "@/lib/store-slug";

describe("toStoreSlug", () => {
  it("transliterates Arabic names into a usable subdomain", () => {
    expect(toStoreSlug("بيت الخزف")).toBe("bit-el-khzf");
    expect(toStoreSlug("وردة")).toBe("wrda");
    expect(toStoreSlug("متجر ٢٠٢٦")).toBe("mtgr-2026");
  });

  it("keeps Latin names as a plain slug", () => {
    expect(toStoreSlug("  My Fashion Store! ")).toBe("my-fashion-store");
  });

  it("caps at 30 chars without a trailing hyphen", () => {
    const slug = toStoreSlug("a".repeat(29) + " b");
    expect(slug.length).toBeLessThanOrEqual(30);
    expect(slug.endsWith("-")).toBe(false);
  });
});
