import { describe, expect, it, vi } from "vitest";

import { pagesStore } from "@/lib/nav/pages-store";

describe("pagesStore", () => {
  it("does not write or notify when a visit changes nothing", () => {
    pagesStore.recordVisit("s1", "/orders");
    const listener = vi.fn();
    const unsubscribe = pagesStore.subscribe(listener);
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    pagesStore.recordVisit("s1", "/orders");
    expect(setItem).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();

    pagesStore.recordVisit("s1", "/products");
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(pagesStore.get("s1").recent.map((r) => r.url)).toEqual(["/products", "/orders"]);

    setItem.mockRestore();
    unsubscribe();
  });
});
