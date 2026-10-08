import { describe, expect, it } from "vitest";

import { averageColor, readableOnWhite } from "@/lib/brand-color";

describe("brand colour from a logo", () => {
  it("averages the logo, ignoring transparent and white background pixels", () => {
    const px = [
      0, 100, 0, 255, // green
      0, 120, 0, 255, // green
      255, 255, 255, 255, // white background
      200, 0, 0, 0, // transparent
    ];
    expect(averageColor(px)).toBe("#006e00");
    expect(averageColor([255, 255, 255, 255])).toBeNull();
  });

  it("only offers colours that stay readable on white", () => {
    expect(readableOnWhite("#1a1a1a")).toBe(true);
    expect(readableOnWhite("#006e00")).toBe(true);
    expect(readableOnWhite("#ffd400")).toBe(false);
  });
});
