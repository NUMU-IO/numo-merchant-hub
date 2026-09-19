import { describe, expect, it } from "vitest";
import { safeRedirect } from "../TokenHandoff";

describe("safeRedirect", () => {
  it("keeps paths inside the hub", () => {
    expect(safeRedirect("/verify-email")).toBe("/verify-email");
    expect(safeRedirect("/?welcome=demo")).toBe("/?welcome=demo");
  });

  it("sends anything that could leave the hub to the root", () => {
    for (const value of [
      null,
      "",
      "https://evil.example/x",
      "//evil.example/x",
      "/\\evil.example/x",
      "javascript:alert(1)",
      " javascript:alert(1)",
    ]) {
      expect(safeRedirect(value)).toBe("/");
    }
  });
});
