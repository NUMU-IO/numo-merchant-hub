import { describe, it, expect } from "vitest";

import { utmSourceLabel, utmMediumLabel, attributionLabel } from "../utm-labels";

describe("utmSourceLabel", () => {
  it("expands the codes merchants actually see in attribution", () => {
    // The bug: the LTV table rendered a bare "ig" as the channel name.
    expect(utmSourceLabel("ig", false)).toBe("Instagram");
    expect(utmSourceLabel("ig", true)).toBe("إنستجرام");
    expect(utmSourceLabel("fb", true)).toBe("فيسبوك");
    expect(utmSourceLabel("tiktok", true)).toBe("تيك توك");
  });

  it("ignores case and surrounding whitespace", () => {
    expect(utmSourceLabel("  IG ", false)).toBe("Instagram");
  });

  it("humanises anything it does not know rather than passing raw", () => {
    expect(utmSourceLabel("partner_blog", false)).toBe("Partner Blog");
    expect(utmSourceLabel("spring-sale", false)).toBe("Spring Sale");
  });

  it("labels an empty source instead of rendering a blank cell", () => {
    expect(utmSourceLabel("", true)).toBe("غير محدد");
    expect(utmSourceLabel("  ", false)).toBe("Unknown");
  });
});

describe("utmMediumLabel", () => {
  it("translates delivery mediums", () => {
    expect(utmMediumLabel("cpc", false)).toBe("Paid search");
    expect(utmMediumLabel("cpc", true)).toBe("بحث مدفوع");
    expect(utmMediumLabel("none", true)).toBe("مباشر");
  });
});

describe("attributionLabel", () => {
  it("routes by the grouping in play", () => {
    expect(attributionLabel("ig", "source", false)).toBe("Instagram");
    expect(attributionLabel("cpc", "medium", false)).toBe("Paid search");
  });

  it("leaves campaign names exactly as the merchant typed them", () => {
    // Campaign values are merchant-authored; mapping them would rewrite
    // someone's own words back at them.
    expect(attributionLabel("ig", "campaign", false)).toBe("ig");
    expect(attributionLabel("eid_sale_2026", "campaign", true)).toBe(
      "eid_sale_2026",
    );
  });
});
