import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { confirmLeave, useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

afterEach(() => vi.restoreAllMocks());

describe("useUnsavedChangesGuard", () => {
  it("asks before leaving only while dirty, for links and navigate() callers", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { rerender, unmount } = renderHook(({ dirty }) => useUnsavedChangesGuard(dirty), {
      initialProps: { dirty: true },
    });

    expect(confirmLeave()).toBe(false);

    const link = document.createElement("a");
    link.href = "/products";
    document.body.appendChild(link);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(confirm).toHaveBeenCalledTimes(2);

    rerender({ dirty: false });
    expect(confirmLeave()).toBe(true);
    const clean = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(2);

    link.remove();
    unmount();
  });
});
