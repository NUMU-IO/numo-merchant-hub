/**
 * printOrderInvoice — opens the order's invoice PDF for printing.
 *
 * The subtle part is ordering: the tab must be opened synchronously, inside
 * the click, BEFORE the fetch. A `window.open` after an `await` is no longer
 * a user gesture and popup blockers swallow it — the merchant clicks "Print"
 * and nothing happens.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { printOrderInvoice } from "@/services/invoiceApi";

const calls: string[] = [];

beforeEach(() => {
  calls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      calls.push("fetch");
      return new Response(new Blob(["%PDF-1.7"]), { status: 200 });
    }),
  );
  URL.createObjectURL = vi.fn(() => "blob:invoice");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("printOrderInvoice", () => {
  it("opens the tab before fetching, then points it at the PDF", async () => {
    const tab = { location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockImplementation(() => {
      calls.push("open");
      return tab as unknown as Window;
    });

    await printOrderInvoice("store-1", "order-1");

    expect(calls).toEqual(["open", "fetch"]);
    expect(tab.location.href).toBe("blob:invoice");
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(url).toContain("/stores/store-1/invoices/by-order/order-1/pdf");
  });

  it("falls back to a download when the popup is blocked", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const click = vi.fn();
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = realCreate(tag);
      if (tag === "a") (el as HTMLAnchorElement).click = click;
      return el;
    });

    await printOrderInvoice("store-1", "order-1");

    expect(click).toHaveBeenCalledOnce();
  });

  it("closes the blank tab and rethrows when the invoice can't load", async () => {
    const tab = { location: { href: "" }, close: vi.fn() };
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );

    await expect(printOrderInvoice("store-1", "order-1")).rejects.toThrow();
    // Leaving an empty tab open reads as "it printed nothing".
    expect(tab.close).toHaveBeenCalledOnce();
  });
});
