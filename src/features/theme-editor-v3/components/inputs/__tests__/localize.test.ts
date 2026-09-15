import { describe, expect, it } from "vitest";

import { localize } from "../localize";

describe("localize", () => {
  it("Arabic prefers locales.ar, then *_ar, then the base key; English ignores *_ar", () => {
    const field = { label: "Title", label_ar: "العنوان", locales: { ar: { label: "عنوان" } } };

    expect(localize(field, "label", "ar")).toBe("عنوان");
    expect(localize({ ...field, locales: {} }, "label", "ar")).toBe("العنوان");
    expect(localize({ label: "Title" }, "label", "ar")).toBe("Title");
    expect(localize(field, "label", "en")).toBe("Title");
  });
});
