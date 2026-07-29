/**
 * BogoSetPicker — the REAL component, not the double.
 *
 * `PromotionForm.multibuy.test.tsx` mocks this component out (it is a Radix
 * Popover + cmdk combobox that fetches products and categories), so every
 * assertion over there is only as good as the double's fidelity. This file
 * is the other half: it drives the actual Popover/cmdk/Tabs and pins the
 * three behaviours that make multi-select usable at all —
 *
 *   1. the popover STAYS OPEN across selections (a picker that closes after
 *      every click makes "pick 3 collections" nine interactions long, and it
 *      is exactly what the single-select version did);
 *   2. selected ids render as removable chips (the only place a merchant can
 *      see a selection whose row isn't on the current search page);
 *   3. the trigger summarises — the single name for one, "N selected" beyond.
 *
 * Only the two API modules are mocked. Everything else is the shipping code.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import i18n from "@/i18n";
import {
  BogoSetPicker,
  type BogoSetValue,
} from "@/components/marketing/BogoSetPicker";

const H = vi.hoisted(() => ({
  listProducts: vi.fn(),
  listCategories: vi.fn(),
}));

vi.mock("@/services/productApi", () => ({ listProducts: H.listProducts }));
vi.mock("@/services/categoryApi", () => ({ listCategories: H.listCategories }));

// ── jsdom gaps the real component's dependencies hit ──────────────────────
// Radix's popper (`use-size`) and cmdk's list sizer both construct a
// ResizeObserver; cmdk scrolls the active item into view. Neither exists in
// jsdom 20. Kept local to this file rather than mutating the shared setup.
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
for (const fn of [
  "hasPointerCapture",
  "setPointerCapture",
  "releasePointerCapture",
] as const) {
  if (!(fn in Element.prototype)) {
    (Element.prototype as unknown as Record<string, unknown>)[fn] = () => false;
  }
}

// ── fixtures ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "cat-1", name: "Scarves", slug: "scarves" },
  { id: "cat-2", name: "Abayas", slug: "abayas" },
  { id: "cat-3", name: "Bags", slug: "bags" },
];

const PRODUCTS = [
  { id: "prod-1", name: "Silk scarf", sku: "SLK-1" },
  { id: "prod-2", name: "Cotton scarf", sku: "CTN-1" },
  { id: "prod-3", name: "Linen wrap", sku: "LIN-1" },
];

function Harness({ initial }: { initial?: Partial<BogoSetValue> }) {
  const [value, setValue] = useState<BogoSetValue>({
    mode: "any",
    productIds: [],
    categoryIds: [],
    ...initial,
  });
  const client = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
      }),
  )[0];
  return (
    <QueryClientProvider client={client}>
      <BogoSetPicker
        storeId="store-1"
        side="eligible"
        mode={value.mode}
        productIds={value.productIds}
        categoryIds={value.categoryIds}
        onChange={setValue}
      />
      <output data-testid="emitted">{JSON.stringify(value)}</output>
    </QueryClientProvider>
  );
}

const emitted = (): BogoSetValue =>
  JSON.parse(screen.getByTestId("emitted").textContent!);

/** Radix Tabs switches on mousedown, not click. */
function switchTab(label: string | RegExp) {
  fireEvent.mouseDown(screen.getByRole("tab", { name: label }), { button: 0 });
}

/** The trigger button. cmdk's search input also has role="combobox" once
 *  the popover is open, so disambiguate on the tag. */
function trigger(): HTMLElement {
  const found = screen
    .getAllByRole("combobox")
    .filter((el) => el.tagName === "BUTTON");
  expect(found).toHaveLength(1);
  return found[0];
}

function openCombobox() {
  fireEvent.click(trigger());
}

/** Chip labels, read off each chip's own Remove button — so chip text can be
 *  asserted without colliding with the option row or the trigger label,
 *  and without coupling the test to class names. */
function chipLabels(removeName = "Remove"): string[] {
  return screen
    .queryAllByRole("button", { name: removeName })
    .map((btn) => btn.parentElement!.textContent!.trim());
}

/** The cmdk option row for `name` inside the open popover. */
async function option(name: string | RegExp) {
  return waitFor(() => screen.getByRole("option", { name }));
}

beforeEach(async () => {
  vi.clearAllMocks();
  H.listCategories.mockResolvedValue(CATEGORIES);
  H.listProducts.mockResolvedValue({
    items: PRODUCTS,
    total: PRODUCTS.length,
    page: 1,
    page_size: 25,
    total_pages: 1,
  });
  await i18n.changeLanguage("en");
});

// ─────────────────────────────────────────────────────────────────────────
// The popover must survive a selection — this is the whole feature
// ─────────────────────────────────────────────────────────────────────────

describe("multi-select popover", () => {
  it("STAYS OPEN across two selections and emits both ids", async () => {
    render(<Harness />);
    switchTab(/Specific categories/i);
    openCombobox();

    fireEvent.click(await option("Scarves scarves"));
    // Still open: the search box and the other rows are still on screen.
    expect(screen.getByPlaceholderText("Search categories…")).toBeVisible();
    expect(screen.getByRole("option", { name: "Abayas abayas" })).toBeVisible();
    expect(emitted().categoryIds).toEqual(["cat-1"]);

    fireEvent.click(screen.getByRole("option", { name: "Abayas abayas" }));
    expect(screen.getByPlaceholderText("Search categories…")).toBeVisible();
    expect(emitted().categoryIds).toEqual(["cat-1", "cat-2"]);
    expect(emitted().mode).toBe("category");
  });

  it("marks selected rows and clears the mark when toggled off", async () => {
    render(<Harness />);
    switchTab(/Specific categories/i);
    openCombobox();
    const row = await option("Scarves scarves");

    // The tick is an opacity swap, so read the class rather than presence.
    const tick = () => row.querySelector("svg")!;
    expect(tick().getAttribute("class")).toContain("opacity-0");
    fireEvent.click(row);
    await waitFor(() =>
      expect(tick().getAttribute("class")).toContain("opacity-100"),
    );
    fireEvent.click(row);
    await waitFor(() =>
      expect(tick().getAttribute("class")).toContain("opacity-0"),
    );
    expect(emitted().categoryIds).toEqual([]);
  });

  it("selects several PRODUCTS in one open session", async () => {
    render(<Harness />);
    switchTab(/Specific products/i);
    openCombobox();

    fireEvent.click(await option("Silk scarf SLK-1"));
    fireEvent.click(screen.getByRole("option", { name: "Linen wrap LIN-1" }));
    expect(screen.getByPlaceholderText("Search products…")).toBeVisible();
    expect(emitted()).toMatchObject({
      mode: "product",
      productIds: ["prod-1", "prod-3"],
      categoryIds: [],
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Chips — the merchant's only view of a selection that isn't on this page
// ─────────────────────────────────────────────────────────────────────────

describe("selected chips", () => {
  it("renders one chip per id, named, and removes on the X", async () => {
    render(<Harness initial={{ mode: "category", categoryIds: ["cat-1", "cat-3"] }} />);
    await waitFor(() => expect(H.listCategories).toHaveBeenCalled());

    // Names resolved from the fetched list, not raw UUIDs.
    await waitFor(() => expect(chipLabels()).toEqual(["Scarves", "Bags"]));

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(emitted().categoryIds).toEqual(["cat-3"]);
    await waitFor(() => expect(chipLabels()).toEqual(["Bags"]));
  });

  it("renders no chip row at all when nothing is selected", async () => {
    render(<Harness initial={{ mode: "category" }} />);
    await waitFor(() => expect(H.listCategories).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("falls back to a truncated id for a selection outside the current page", async () => {
    // A merchant editing a promotion scoped to a category that doesn't come
    // back in the first 25 rows must still see SOMETHING removable, never a
    // blank chip.
    render(
      <Harness
        initial={{ mode: "category", categoryIds: ["ffffffff-dead-4beef-8000-000000000000"] }}
      />,
    );
    await waitFor(() => expect(H.listCategories).toHaveBeenCalled());
    await waitFor(() => expect(chipLabels()).toEqual(["Category ffffffff…"]));
    // …and the trigger says the same thing rather than going blank.
    expect(trigger().textContent).toContain("Category ffffffff…");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Trigger label
// ─────────────────────────────────────────────────────────────────────────

describe("trigger label", () => {
  it('reads the placeholder at 0, the NAME at 1, and "2 selected" at 2', async () => {
    render(<Harness />);
    switchTab(/Specific categories/i);
    await waitFor(() => expect(H.listCategories).toHaveBeenCalled());
    expect(trigger().textContent).toContain("Select categories…");

    openCombobox();
    fireEvent.click(await option("Scarves scarves"));
    await waitFor(() => expect(trigger().textContent).toContain("Scarves"));
    expect(trigger().textContent).not.toContain("selected");

    fireEvent.click(screen.getByRole("option", { name: "Abayas abayas" }));
    await waitFor(() => expect(trigger().textContent).toContain("2 selected"));
    // Not "Scarves, Abayas" and not just "Scarves" — the summary is the point.
    expect(trigger().textContent).not.toContain("Abayas");
    expect(trigger().textContent).not.toContain("Scarves");
  });

  it("summarises 3 as \"3 selected\"", async () => {
    render(
      <Harness
        initial={{ mode: "product", productIds: ["prod-1", "prod-2", "prod-3"] }}
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox").textContent).toContain("3 selected"),
    );
  });

  it("shows the products placeholder on the product tab", async () => {
    render(<Harness />);
    switchTab(/Specific products/i);
    await waitFor(() =>
      expect(screen.getByRole("combobox").textContent).toContain(
        "Select products…",
      ),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Tabs / modes
// ─────────────────────────────────────────────────────────────────────────

describe("mode tabs", () => {
  it('"Any product" shows the multibuy hint and no combobox', async () => {
    render(<Harness />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(
      screen.getByText("Every product in the store counts toward the bundle."),
    ).toBeInTheDocument();
    // …and the eligible-side title is the sr-only marker, not BOGO's.
    expect(
      screen.getByText("Eligible products or collection"),
    ).toBeInTheDocument();
  });

  it("BOGO's buy side gets BOGO copy, not the multibuy hint", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BogoSetPicker
          storeId="store-1"
          side="buy"
          mode="any"
          productIds={[]}
          categoryIds={[]}
          onChange={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(
      screen.getByText(
        "Any product in the cart counts toward the buy threshold.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Customer buys (the trigger)")).toBeInTheDocument();
  });

  it("BOGO's get side gets the get-side hint", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BogoSetPicker
          storeId="store-1"
          side="get"
          mode="any"
          productIds={[]}
          categoryIds={[]}
          onChange={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(
      screen.getByText(
        "The discount is applied to the cheapest unit(s) in the cart.",
      ),
    ).toBeInTheDocument();
  });

  it("switching category → product DISCARDS the category ids (documented behaviour)", async () => {
    // NOTE: the source comment on the Tabs `onValueChange` says it keeps
    // "each tab's own selection while switching between them". It does not:
    // the callback emits `[]` for the inactive kind and the FORM stores
    // exactly what it is handed, so the ids are gone by the time the tab is
    // re-entered. Pinned as-is because the payload consequence is the safe
    // one (no cross-kind leak, see PromotionForm.multibuy.test.tsx) — but
    // the comment overstates what the code does.
    render(<Harness />);
    switchTab(/Specific categories/i);
    openCombobox();
    fireEvent.click(await option("Scarves scarves"));
    expect(emitted().categoryIds).toEqual(["cat-1"]);

    switchTab(/Specific products/i);
    expect(emitted()).toMatchObject({
      mode: "product",
      productIds: [],
      categoryIds: [],
    });

    switchTab(/Specific categories/i);
    expect(emitted().categoryIds).toEqual([]);
  });

  it('switching to "Any product" clears both lists', async () => {
    render(<Harness initial={{ mode: "category", categoryIds: ["cat-1", "cat-2"] }} />);
    await waitFor(() => expect(H.listCategories).toHaveBeenCalled());
    switchTab(/Any product/i);
    expect(emitted()).toEqual({
      mode: "any",
      productIds: [],
      categoryIds: [],
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Bilingual — the AR dashboard is NUMU's primary locale
// ─────────────────────────────────────────────────────────────────────────

describe("Arabic", () => {
  it("labels, placeholder and the N-selected summary are in Arabic", async () => {
    await i18n.changeLanguage("ar");
    render(<Harness initial={{ mode: "category", categoryIds: ["cat-1", "cat-2"] }} />);
    await waitFor(() => expect(H.listCategories).toHaveBeenCalled());

    expect(screen.getByRole("tab", { name: /أي منتج/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole("combobox").textContent).toContain("2 محددة"),
    );
    expect(chipLabels("إزالة")).toEqual(["Scarves", "Abayas"]);
    // No raw i18n key leaked through the sr-only title / hint.
    expect(document.body.textContent).not.toMatch(/promotions\.form\./);
  });

  it("the multibuy any-hint renders in Arabic", async () => {
    await i18n.changeLanguage("ar");
    render(<Harness />);
    expect(
      screen.getByText("كل منتجات المتجر بتتحسب في الباقة."),
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────────────────────────────────

describe("search", () => {
  it("filters categories client-side and keeps the selection", async () => {
    render(<Harness initial={{ mode: "category", categoryIds: ["cat-1"] }} />);
    await waitFor(() => expect(H.listCategories).toHaveBeenCalled());
    openCombobox();
    await option("Scarves scarves");

    fireEvent.change(screen.getByPlaceholderText("Search categories…"), {
      target: { value: "aba" },
    });
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "Scarves scarves" })).toBeNull(),
    );
    expect(screen.getByRole("option", { name: "Abayas abayas" })).toBeVisible();
    // Chip for the now-filtered-out selection is still there.
    expect(chipLabels()).toEqual(["Scarves"]);
    expect(emitted().categoryIds).toEqual(["cat-1"]);
  });

  it("passes the product search term to the API (server-side filtering)", async () => {
    render(<Harness initial={{ mode: "product" }} />);
    openCombobox();
    await waitFor(() => expect(H.listProducts).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("Search products…"), {
      target: { value: "silk" },
    });
    await waitFor(() =>
      expect(H.listProducts).toHaveBeenLastCalledWith("store-1", {
        search: "silk",
        limit: 25,
      }),
    );
  });

  it("shows an empty state, not a blank list, when nothing matches", async () => {
    H.listProducts.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 25,
      total_pages: 1,
    });
    render(<Harness initial={{ mode: "product" }} />);
    openCombobox();
    expect(await screen.findByText("No products found.")).toBeInTheDocument();
  });

  it("does not fetch at all without a store id", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <BogoSetPicker
          storeId={undefined}
          side="eligible"
          mode="category"
          productIds={[]}
          categoryIds={[]}
          onChange={() => {}}
        />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("combobox"));
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Search categories…")).toBeVisible(),
    );
    expect(H.listCategories).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Accessibility basics
// ─────────────────────────────────────────────────────────────────────────

describe("a11y", () => {
  it("the trigger announces its expanded state", async () => {
    render(<Harness initial={{ mode: "category" }} />);
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    openCombobox();
    await waitFor(() =>
      expect(screen.getByPlaceholderText("Search categories…")).toBeVisible(),
    );
    expect(trigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("each chip's remove control is a labelled button, not a bare icon", async () => {
    render(<Harness initial={{ mode: "category", categoryIds: ["cat-1"] }} />);
    await waitFor(() => expect(H.listCategories).toHaveBeenCalled());
    const remove = await screen.findByRole("button", { name: "Remove" });
    expect(remove.tagName).toBe("BUTTON");
    expect(remove).toHaveAttribute("type", "button");
  });

  it("the sr-only side title distinguishes the two BOGO pickers on one page", () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <BogoSetPicker
          storeId="store-1"
          side="buy"
          mode="any"
          productIds={[]}
          categoryIds={[]}
          onChange={() => {}}
        />
        <BogoSetPicker
          storeId="store-1"
          side="get"
          mode="any"
          productIds={[]}
          categoryIds={[]}
          onChange={() => {}}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Customer buys (the trigger)")).toBeInTheDocument();
    expect(screen.getByText("Customer gets (the discount)")).toBeInTheDocument();
  });
});
