import { describe, expect, it } from "vitest";

import { loginPath, safeNext } from "@/lib/login-redirect";

describe("login return URL", () => {
  it("carries the page being left", () => {
    expect(loginPath("/orders/42", "?tab=items")).toBe("/login?next=%2Forders%2F42%3Ftab%3Ditems");
    expect(loginPath("/")).toBe("/login");
  });

  it("only follows same-site paths", () => {
    expect(safeNext("/orders/42?tab=items")).toBe("/orders/42?tab=items");
    expect(safeNext("//evil.com")).toBe("/");
    expect(safeNext("/\\evil.com")).toBe("/");
    expect(safeNext("https://evil.com")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });
});
