/**
 * PromotionForm — the `multibuy` rule kind (WS3 of docs/Plans/OFFER-VIONNE.md).
 *
 * `buildDiscountRule` / `buildTargets` / `validate` are closures inside the
 * component, so they are exercised the way a merchant exercises them: render
 * the form, drive the real inputs, submit, and inspect the payload handed to
 * the (mocked) mutation. No source was refactored to make this testable.
 *
 * The load-bearing assertion in here is the `role: "buy_set"` tag on the
 * eligible-set target. Without it the target is an eligibility GATE rather
 * than a line filter — the offer would then apply to a whole cart whenever a
 * single eligible item was present, i.e. it would discount ineligible items.
 *
 * Mocked at module boundaries only: store context, promotion hooks (network),
 * sonner, and BogoSetPicker (a Radix Popover + cmdk combobox that fetches
 * products/categories).
 *
 * The picker's CONTRACT with the form is `props {mode, productIds[],
 * categoryIds[]}` + `onChange({mode, productIds[], categoryIds[]})`. The
 * double reproduces it exactly, INCLUDING the real component's toggle
 * semantics (`toggle()` in BogoSetPicker.tsx) — a double that only ever
 * emitted a single id would re-introduce the very bug this file now guards.
 * The real component's own behaviour (popover, chips, trigger label) is
 * covered against the real thing in
 * `src/components/marketing/__tests__/BogoSetPicker.test.tsx`.
 *
 * `side` is "buy"/"get" for BOGO and "eligible" for multibuy, so the
 * multibuy picker is `picker-eligible` here — the testid follows the prop.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import i18n from "@/i18n";
import ar from "@/i18n/ar";
import en from "@/i18n/en";
import type {
  CreatePromotionRequest,
  Promotion,
  UpdatePromotionRequest,
} from "@/services/promotionApi";
import {
  MULTIBUY_PYTHON_TYPE_ACCEPTS,
  MULTIBUY_PYTHON_TYPE_REJECTS,
} from "@/lib/__tests__/multibuy-python-vectors";

const H = vi.hoisted(() => {
  const CATEGORY_IDS = [
    "22222222-2222-4222-8222-222222222222",
    "44444444-4444-4444-8444-444444444444",
    "55555555-5555-4555-8555-555555555555",
  ];
  const PRODUCT_IDS = [
    "33333333-3333-4333-8333-333333333333",
    "66666666-6666-4666-8666-666666666666",
    "77777777-7777-4777-8777-777777777777",
  ];
  return {
    STORE_ID: "11111111-1111-4111-8111-111111111111",
    CATEGORY_IDS,
    PRODUCT_IDS,
    CATEGORY_ID: CATEGORY_IDS[0],
    PRODUCT_ID: PRODUCT_IDS[0],
    createMutateAsync: vi.fn(),
    updateMutateAsync: vi.fn(),
    promotionData: { current: undefined as Promotion | undefined },
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
  };
});

vi.mock("@/contexts/StoreContext", () => ({
  useDashboardStore: () => ({ currentStore: { id: H.STORE_ID } }),
}));

vi.mock("sonner", () => ({
  toast: { error: H.toastError, success: H.toastSuccess },
}));

vi.mock("@/hooks/usePromotions", () => ({
  usePromotion: () => ({
    data: H.promotionData.current,
    isLoading: false,
  }),
  useCreatePromotion: () => ({ mutateAsync: H.createMutateAsync }),
  useUpdatePromotion: () => ({ mutateAsync: H.updateMutateAsync }),
}));

vi.mock("@/components/marketing/BogoSetPicker", () => {
  // Mirrors `toggle()` in the real BogoSetPicker: add if absent, remove if
  // present, order otherwise preserved.
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

  return {
    BogoSetPicker: (props: {
      side: "buy" | "get" | "eligible";
      mode: "any" | "product" | "category";
      productIds: string[];
      categoryIds: string[];
      onChange: (next: {
        mode: "any" | "product" | "category";
        productIds: string[];
        categoryIds: string[];
      }) => void;
    }) => (
      <div
        data-testid={`picker-${props.side}`}
        data-mode={props.mode}
        // Joined so a test can read back the exact list AND its order.
        data-products={props.productIds.join(",")}
        data-categories={props.categoryIds.join(",")}
        data-product-count={props.productIds.length}
        data-category-count={props.categoryIds.length}
      >
        {H.CATEGORY_IDS.map((id, i) => (
          <button
            key={id}
            type="button"
            data-testid={`picker-${props.side}-category-${i + 1}`}
            onClick={() =>
              props.onChange({
                mode: "category",
                productIds: [],
                categoryIds: toggle(props.categoryIds, id),
              })
            }
          />
        ))}
        {H.PRODUCT_IDS.map((id, i) => (
          <button
            key={id}
            type="button"
            data-testid={`picker-${props.side}-product-${i + 1}`}
            onClick={() =>
              props.onChange({
                mode: "product",
                productIds: toggle(props.productIds, id),
                categoryIds: [],
              })
            }
          />
        ))}
        {/* The three tab triggers, which emit a mode change and drop the
            other kind's ids — exactly what the real component's Tabs
            `onValueChange` does. */}
        <button
          type="button"
          data-testid={`picker-${props.side}-any`}
          onClick={() =>
            props.onChange({ mode: "any", productIds: [], categoryIds: [] })
          }
        />
        <button
          type="button"
          data-testid={`picker-${props.side}-tab-product`}
          onClick={() =>
            props.onChange({
              mode: "product",
              productIds: props.productIds,
              categoryIds: [],
            })
          }
        />
        <button
          type="button"
          data-testid={`picker-${props.side}-tab-category`}
          onClick={() =>
            props.onChange({
              mode: "category",
              productIds: [],
              categoryIds: props.categoryIds,
            })
          }
        />
      </div>
    ),
  };
});

import PromotionForm from "../PromotionForm";

// jsdom ships no ResizeObserver; Radix's `use-size` (behind Tabs/Select)
// constructs one on mount. Test-environment gap only — kept local to this
// file rather than mutating the shared setup.
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
}

// ── helpers ──────────────────────────────────────────────────────────────

function renderForm(entry = "/marketing/promotions/new?surface=automatic") {
  const utils = render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/marketing/promotions/new" element={<PromotionForm />} />
        <Route
          path="/marketing/promotions/:id/edit"
          element={<PromotionForm />}
        />
        <Route path="/marketing/promotions" element={<div>list</div>} />
      </Routes>
    </MemoryRouter>,
  );
  return utils;
}

const form = () => document.querySelector("form") as HTMLFormElement;
const submit = () => fireEvent.submit(form());

function setInput(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement;
  expect(el, `#${id} should be rendered`).toBeTruthy();
  fireEvent.change(el, { target: { value } });
}

function inputValue(id: string): string {
  return (document.getElementById(id) as HTMLInputElement).value;
}

function applyTemplate(id: string) {
  fireEvent.click(screen.getByTestId(`rule-template-${id}`));
}

async function createPayload(): Promise<CreatePromotionRequest> {
  await waitFor(() => expect(H.createMutateAsync).toHaveBeenCalled());
  return H.createMutateAsync.mock.calls.at(-1)![0] as CreatePromotionRequest;
}

async function updatePayload(): Promise<UpdatePromotionRequest> {
  await waitFor(() => expect(H.updateMutateAsync).toHaveBeenCalled());
  return H.updateMutateAsync.mock.calls.at(-1)![0] as UpdatePromotionRequest;
}

const SAVED_MULTIBUY: Promotion = {
  id: "promo-multibuy-1",
  tenant_id: "tenant-1",
  store_id: H.STORE_ID,
  name: "Ultimate Trio",
  surface: "automatic",
  status: "draft",
  coupon_id: null,
  discount_rule: {
    kind: "multibuy",
    multibuy_quantity: 3,
    multibuy_price_cents: 65000,
  },
  content: { surface: "automatic" },
  translations: {},
  displays: [],
  targets: [
    {
      id: "target-1",
      target_kind: "category",
      target_value: { category_ids: [H.CATEGORY_ID] },
      inclusion: true,
      role: "buy_set",
    },
  ],
  priority: 0,
  starts_at: null,
  ends_at: null,
  version: 7,
  usage_limit_total: null,
  usage_limit_per_customer: null,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
  metrics: {
    impressions: 0,
    clicks: 0,
    dismissals: 0,
    redemptions: 0,
    conversions: 0,
    revenue_cents: 0,
  },
};

beforeEach(async () => {
  vi.clearAllMocks();
  H.promotionData.current = undefined;
  H.createMutateAsync.mockResolvedValue({ id: "new-promo" });
  H.updateMutateAsync.mockResolvedValue({ id: "promo-multibuy-1" });
  await i18n.changeLanguage("en");
});

// ─────────────────────────────────────────────────────────────────────────
// B. buildDiscountRule / buildTargets — payload shape
// ─────────────────────────────────────────────────────────────────────────

describe("B. multibuy payload shape", () => {
  it("sends multibuy_quantity + multibuy_price_cents as NUMBERS", async () => {
    renderForm();
    setInput("promo-name", "Ultimate Trio");
    applyTemplate("multibuy_3_for_650");
    submit();

    const payload = await createPayload();
    expect(payload.discount_rule).toEqual({
      kind: "multibuy",
      multibuy_quantity: 3,
      multibuy_price_cents: 65000,
    });
    expect(typeof payload.discount_rule!.multibuy_quantity).toBe("number");
    expect(typeof payload.discount_rule!.multibuy_price_cents).toBe("number");
  });

  it("does NOT send bogo or tiered fields on a multibuy rule", async () => {
    renderForm();
    setInput("promo-name", "Ultimate Trio");
    applyTemplate("multibuy_3_for_650");
    submit();

    const rule = (await createPayload()).discount_rule!;
    expect(rule).not.toHaveProperty("buy_quantity");
    expect(rule).not.toHaveProperty("get_quantity");
    expect(rule).not.toHaveProperty("get_discount_percent");
    expect(rule).not.toHaveProperty("tiers");
    expect(rule).not.toHaveProperty("value_percent");
    expect(rule).not.toHaveProperty("value_cents");
  });

  it("emits exactly ONE eligible-set target, role-tagged buy_set (category)", async () => {
    renderForm();
    setInput("promo-name", "Ultimate Trio");
    applyTemplate("multibuy_3_for_650");
    fireEvent.click(screen.getByTestId("picker-eligible-category-1"));
    submit();

    const payload = await createPayload();
    expect(payload.targets).toHaveLength(1);
    expect(payload.targets![0]).toEqual({
      target_kind: "category",
      target_value: { category_ids: [H.CATEGORY_ID] },
      inclusion: true,
      role: "buy_set",
    });
  });

  it("the role tag is PRESENT — an untagged target would be an eligibility gate", async () => {
    // Called out on its own because a silently-dropped `role` is not a
    // visible bug: the promotion still saves, still shows in the list, and
    // then over-discounts real carts.
    renderForm();
    setInput("promo-name", "Ultimate Trio");
    applyTemplate("multibuy_3_for_650");
    fireEvent.click(screen.getByTestId("picker-eligible-category-1"));
    submit();

    const target = (await createPayload()).targets![0];
    expect(target.role).toBe("buy_set");
    expect(target.role).not.toBeUndefined();
    expect(target.role).not.toBeNull();
  });

  it("emits a product-scoped target with role buy_set", async () => {
    renderForm();
    setInput("promo-name", "Ultimate Trio");
    applyTemplate("multibuy_3_for_650");
    fireEvent.click(screen.getByTestId("picker-eligible-product-1"));
    submit();

    const payload = await createPayload();
    expect(payload.targets).toEqual([
      {
        target_kind: "product",
        target_value: { product_ids: [H.PRODUCT_ID] },
        inclusion: true,
        role: "buy_set",
      },
    ]);
  });

  it('mode "any" emits NO target (engine reads that as "all products qualify")', async () => {
    renderForm();
    setInput("promo-name", "Ultimate Trio");
    applyTemplate("multibuy_3_for_650");
    // Default is already "any"; assert the rendered picker agrees.
    expect(screen.getByTestId("picker-eligible").dataset.mode).toBe("any");
    submit();

    expect((await createPayload()).targets).toEqual([]);
  });

  it('switching a picked set back to "any" clears the target', async () => {
    renderForm();
    setInput("promo-name", "Ultimate Trio");
    applyTemplate("multibuy_3_for_650");
    fireEvent.click(screen.getByTestId("picker-eligible-category-1"));
    fireEvent.click(screen.getByTestId("picker-eligible-any"));
    submit();

    expect((await createPayload()).targets).toEqual([]);
  });

  it("renders exactly one picker for multibuy (no give-away side)", () => {
    renderForm();
    applyTemplate("multibuy_3_for_650");
    expect(screen.getAllByTestId(/^picker-(buy|get|eligible)$/)).toHaveLength(1);
    expect(screen.getByTestId("picker-eligible")).toBeInTheDocument();
    expect(screen.queryByTestId("picker-buy")).not.toBeInTheDocument();
    expect(screen.queryByTestId("picker-get")).not.toBeInTheDocument();
  });

  it("multibuy → bogo does not leak multibuy_* into the payload", async () => {
    renderForm();
    setInput("promo-name", "Switcheroo");
    applyTemplate("multibuy_3_for_650");
    applyTemplate("bogo_2_1_free");
    submit();

    const rule = (await createPayload()).discount_rule!;
    expect(rule).toEqual({
      kind: "bogo",
      buy_quantity: 2,
      get_quantity: 1,
      get_discount_percent: 100,
    });
    expect(rule).not.toHaveProperty("multibuy_quantity");
    expect(rule).not.toHaveProperty("multibuy_price_cents");
  });

  it("bogo → multibuy does not leak bogo fields into the payload", async () => {
    renderForm();
    setInput("promo-name", "Switcheroo");
    applyTemplate("bogo_2_1_free");
    applyTemplate("multibuy_3_for_650");
    submit();

    const rule = (await createPayload()).discount_rule!;
    expect(rule).toEqual({
      kind: "multibuy",
      multibuy_quantity: 3,
      multibuy_price_cents: 65000,
    });
  });

  it("tiered → multibuy does not leak tiers into the payload", async () => {
    renderForm();
    setInput("promo-name", "Switcheroo");
    applyTemplate("tiered_3_step");
    applyTemplate("multibuy_3_for_650");
    submit();

    expect((await createPayload()).discount_rule).toEqual({
      kind: "multibuy",
      multibuy_quantity: 3,
      multibuy_price_cents: 65000,
    });
  });

  it("carries min_subtotal_cents / max_discount_cents through unchanged", async () => {
    renderForm();
    setInput("promo-name", "Ultimate Trio");
    applyTemplate("multibuy_3_for_650");
    setInput("rule-min", "50000");
    setInput("rule-max", "15000");
    submit();

    expect((await createPayload()).discount_rule).toEqual({
      kind: "multibuy",
      multibuy_quantity: 3,
      multibuy_price_cents: 65000,
      min_subtotal_cents: 50000,
      max_discount_cents: 15000,
    });
  });

  it("typed values (not just template chips) reach the payload as numbers", async () => {
    renderForm();
    setInput("promo-name", "Custom bundle");
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-qty", "4");
    setInput("rule-multibuy-price", "80000");
    submit();

    expect((await createPayload()).discount_rule).toEqual({
      kind: "multibuy",
      multibuy_quantity: 4,
      multibuy_price_cents: 80000,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B2. Multi-select — the eligible set is a LIST, and it must survive a save
//
// This block is the reason the picker changed. Two failures live here:
//   (1) the offer "any 3 from these 2 collections" could not be built at all;
//   (2) worse — a promotion already scoped to 2 categories via the API lost
//       every id but the first the next time a merchant pressed Save in the
//       hub, for ANY edit (a rename, a date change). `buildTargets()` rebuilds
//       the target list from form state on every save, so whatever the
//       hydrator dropped was gone from the row. Silent scope loss on a live
//       campaign: the promotion still saves, still looks right in the list,
//       and quietly stops applying to half the catalogue.
// ─────────────────────────────────────────────────────────────────────────

/** A saved multibuy carrying `ids` on its role-tagged eligible set. */
function savedMultibuyWith(
  kind: "product" | "category",
  ids: string[],
): Promotion {
  return {
    ...SAVED_MULTIBUY,
    targets: [
      {
        id: "target-1",
        target_kind: kind,
        target_value:
          kind === "category" ? { category_ids: ids } : { product_ids: ids },
        inclusion: true,
        role: "buy_set",
      },
    ],
  };
}

/** Hydrate `promo`, change nothing, press Save, return the PATCH payload. */
async function saveUntouched(promo: Promotion): Promise<UpdatePromotionRequest> {
  H.promotionData.current = promo;
  renderForm("/marketing/promotions/promo-multibuy-1/edit");
  await waitFor(() =>
    expect(document.getElementById("rule-multibuy-qty")).toBeTruthy(),
  );
  submit();
  return updatePayload();
}

describe("B2. multi-select eligible set", () => {
  // ── the regression that motivated the change ──────────────────────────
  it("REGRESSION F27: a 2-CATEGORY set survives hydrate → untouched Save", async () => {
    // The exact vionne case: "any 3 from these 2 collections". Before the
    // fix `decomposeBogoTarget` read `ids?.[0]`, so this PATCH shipped ONE
    // category and the offer silently halved its reach.
    const [c1, c2] = H.CATEGORY_IDS;
    const payload = await saveUntouched(savedMultibuyWith("category", [c1, c2]));

    expect(payload.targets).toEqual([
      {
        target_kind: "category",
        target_value: { category_ids: [c1, c2] },
        inclusion: true,
        role: "buy_set",
      },
    ]);
    // Spelled out separately: a length-1 array here is the bug, and a bare
    // `toEqual` on the whole payload can read as a formatting quibble.
    const ids = (payload.targets![0].target_value as { category_ids: string[] })
      .category_ids;
    expect(ids).toHaveLength(2);
    expect(ids).toContain(c2);
  });

  it("REGRESSION F27: a 2-PRODUCT set survives hydrate → untouched Save", async () => {
    const [p1, p2] = H.PRODUCT_IDS;
    const payload = await saveUntouched(savedMultibuyWith("product", [p1, p2]));

    expect(payload.targets).toEqual([
      {
        target_kind: "product",
        target_value: { product_ids: [p1, p2] },
        inclusion: true,
        role: "buy_set",
      },
    ]);
  });

  it("REGRESSION F27: a 5-id set survives hydrate → untouched Save, in order", async () => {
    // 3+ ids: proves the fix reads the whole list, not "the first two".
    const ids = [...H.CATEGORY_IDS, ...H.PRODUCT_IDS.slice(0, 2)];
    const payload = await saveUntouched(savedMultibuyWith("category", ids));

    expect(
      (payload.targets![0].target_value as { category_ids: string[] })
        .category_ids,
    ).toEqual(ids);
  });

  it("REGRESSION F27: the picker is HYDRATED with every id, not just the first", async () => {
    // The payload assertions above would also pass if the form kept a hidden
    // copy of the saved ids; this proves the merchant actually SEES all of
    // them, which is what makes the set editable rather than a trap.
    const [c1, c2] = H.CATEGORY_IDS;
    H.promotionData.current = savedMultibuyWith("category", [c1, c2]);
    renderForm("/marketing/promotions/promo-multibuy-1/edit");
    await waitFor(() =>
      expect(screen.getByTestId("picker-eligible")).toBeTruthy(),
    );

    const picker = screen.getByTestId("picker-eligible");
    expect(picker.dataset.mode).toBe("category");
    expect(picker.dataset.categories).toBe(`${c1},${c2}`);
    expect(picker.dataset.categoryCount).toBe("2");
  });

  // ── creating a multi-id set from scratch ──────────────────────────────
  it("selecting 2 categories emits ONE row carrying BOTH ids", async () => {
    // Not two rows (the engine would union them anyway, but the row set is
    // what round-trips through the hydrator) and not one id.
    const [c1, c2] = H.CATEGORY_IDS;
    renderForm();
    setInput("promo-name", "Any 3 from two collections");
    applyTemplate("multibuy_3_for_650");
    fireEvent.click(screen.getByTestId("picker-eligible-category-1"));
    fireEvent.click(screen.getByTestId("picker-eligible-category-2"));
    submit();

    const targets = (await createPayload()).targets!;
    expect(targets).toHaveLength(1);
    expect(targets[0]).toEqual({
      target_kind: "category",
      target_value: { category_ids: [c1, c2] },
      inclusion: true,
      role: "buy_set",
    });
  });

  it("selecting 3 products emits ONE row carrying all three", async () => {
    renderForm();
    setInput("promo-name", "Trio of products");
    applyTemplate("multibuy_3_for_650");
    fireEvent.click(screen.getByTestId("picker-eligible-product-1"));
    fireEvent.click(screen.getByTestId("picker-eligible-product-2"));
    fireEvent.click(screen.getByTestId("picker-eligible-product-3"));
    submit();

    const targets = (await createPayload()).targets!;
    expect(targets).toHaveLength(1);
    expect(targets[0].target_value).toEqual({ product_ids: H.PRODUCT_IDS });
  });

  it("selection ORDER is preserved into the payload", async () => {
    // The engine unions the ids, so order is not semantic — but it is what
    // the merchant sees in the chip row, and a set that reshuffles itself on
    // every save reads as data loss.
    const [c1, , c3] = H.CATEGORY_IDS;
    renderForm();
    setInput("promo-name", "Order matters visually");
    applyTemplate("multibuy_3_for_650");
    fireEvent.click(screen.getByTestId("picker-eligible-category-3"));
    fireEvent.click(screen.getByTestId("picker-eligible-category-1"));
    submit();

    expect((await createPayload()).targets![0].target_value).toEqual({
      category_ids: [c3, c1],
    });
  });

  it("toggling an already-selected id REMOVES it", async () => {
    const [c1, c2] = H.CATEGORY_IDS;
    renderForm();
    setInput("promo-name", "Deselect one");
    applyTemplate("multibuy_3_for_650");
    fireEvent.click(screen.getByTestId("picker-eligible-category-1"));
    fireEvent.click(screen.getByTestId("picker-eligible-category-2"));
    expect(screen.getByTestId("picker-eligible").dataset.categories).toBe(
      `${c1},${c2}`,
    );
    fireEvent.click(screen.getByTestId("picker-eligible-category-1")); // off
    submit();

    expect((await createPayload()).targets![0].target_value).toEqual({
      category_ids: [c2],
    });
  });

  it("removing the LAST id emits no target at all (= any product)", async () => {
    renderForm();
    setInput("promo-name", "Back to any");
    applyTemplate("multibuy_3_for_650");
    fireEvent.click(screen.getByTestId("picker-eligible-category-1"));
    fireEvent.click(screen.getByTestId("picker-eligible-category-1")); // off
    // Mode is still "category" — so it is the EMPTY LIST that suppresses the
    // target, not a hidden reset to "any". An emitted
    // `{category_ids: []}` row would gate the offer to nothing at all.
    expect(screen.getByTestId("picker-eligible").dataset.mode).toBe("category");
    expect(screen.getByTestId("picker-eligible").dataset.categories).toBe("");
    submit();

    expect((await createPayload()).targets).toEqual([]);
  });

  // ── mode switching must not mix kinds ─────────────────────────────────
  it("product → category → product leaks NO ids across kinds", async () => {
    renderForm();
    setInput("promo-name", "Mode hopping");
    applyTemplate("multibuy_3_for_650");
    fireEvent.click(screen.getByTestId("picker-eligible-product-1"));
    fireEvent.click(screen.getByTestId("picker-eligible-product-2"));
    fireEvent.click(screen.getByTestId("picker-eligible-category-1"));
    fireEvent.click(screen.getByTestId("picker-eligible-product-3"));
    submit();

    const targets = (await createPayload()).targets!;
    expect(targets).toHaveLength(1);
    expect(targets[0].target_kind).toBe("product");
    // Only the ids picked since the last kind switch — no category id, and
    // no resurrected p1/p2.
    expect(targets[0].target_value).toEqual({
      product_ids: [H.PRODUCT_IDS[2]],
    });
    expect(JSON.stringify(targets)).not.toContain(H.CATEGORY_IDS[0]);
  });

  it("a category set switched to the products TAB emits no stale category row", async () => {
    // Tab switch only — no product picked afterwards. The category ids must
    // not survive as a `category` row while the UI shows the product tab.
    renderForm();
    setInput("promo-name", "Tab hop");
    applyTemplate("multibuy_3_for_650");
    fireEvent.click(screen.getByTestId("picker-eligible-category-1"));
    fireEvent.click(screen.getByTestId("picker-eligible-category-2"));
    fireEvent.click(screen.getByTestId("picker-eligible-tab-product"));
    submit();

    expect((await createPayload()).targets).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B3. BOGO — the picker is SHARED, so this is the main regression risk
//
// Multibuy reuses BOGO's component and BOGO's `buy_set` role. Everything
// below already worked before the multi-select change and must still work:
// two independent sets, each role-tagged, neither able to see the other's
// ids. A bug here is worse than a multibuy bug — BOGO is already live.
// ─────────────────────────────────────────────────────────────────────────

const SAVED_BOGO: Promotion = {
  ...SAVED_MULTIBUY,
  id: "promo-bogo-1",
  name: "Buy 2 get 1",
  discount_rule: {
    kind: "bogo",
    buy_quantity: 2,
    get_quantity: 1,
    get_discount_percent: 100,
  },
  targets: [],
};

describe("B3. BOGO still works (shared picker)", () => {
  it("buy-set and get-set each emit their OWN role-tagged row", async () => {
    renderForm();
    setInput("promo-name", "Two sides");
    applyTemplate("bogo_2_1_free");
    fireEvent.click(screen.getByTestId("picker-buy-category-1"));
    fireEvent.click(screen.getByTestId("picker-get-product-1"));
    submit();

    const targets = (await createPayload()).targets!;
    expect(targets).toHaveLength(2);
    expect(targets).toEqual([
      {
        target_kind: "category",
        target_value: { category_ids: [H.CATEGORY_IDS[0]] },
        inclusion: true,
        role: "buy_set",
      },
      {
        target_kind: "product",
        target_value: { product_ids: [H.PRODUCT_IDS[0]] },
        inclusion: true,
        role: "get_set",
      },
    ]);
  });

  it("both sides go MULTI, independently, with no cross-contamination", async () => {
    const [c1, c2, c3] = H.CATEGORY_IDS;
    const [p1, p2] = H.PRODUCT_IDS;
    renderForm();
    setInput("promo-name", "Multi both sides");
    applyTemplate("bogo_2_1_free");
    fireEvent.click(screen.getByTestId("picker-buy-category-1"));
    fireEvent.click(screen.getByTestId("picker-buy-category-2"));
    fireEvent.click(screen.getByTestId("picker-buy-category-3"));
    fireEvent.click(screen.getByTestId("picker-get-product-1"));
    fireEvent.click(screen.getByTestId("picker-get-product-2"));
    submit();

    const targets = (await createPayload()).targets!;
    const buy = targets.find((t) => t.role === "buy_set")!;
    const get = targets.find((t) => t.role === "get_set")!;
    expect(buy.target_value).toEqual({ category_ids: [c1, c2, c3] });
    expect(get.target_value).toEqual({ product_ids: [p1, p2] });
    // The give-away row must not have inherited a buy-side id and vice versa.
    expect(JSON.stringify(get.target_value)).not.toContain(c1);
    expect(JSON.stringify(buy.target_value)).not.toContain(p1);
  });

  it("both sides on the SAME kind stay two separate rows", async () => {
    // The nastiest cross-contamination shape: identical target_kind, so a
    // shared-state bug would be invisible in the kind and only show in ids.
    const [c1, c2, c3] = H.CATEGORY_IDS;
    renderForm();
    setInput("promo-name", "Categories both sides");
    applyTemplate("bogo_2_1_free");
    fireEvent.click(screen.getByTestId("picker-buy-category-1"));
    fireEvent.click(screen.getByTestId("picker-buy-category-2"));
    fireEvent.click(screen.getByTestId("picker-get-category-3"));
    submit();

    const targets = (await createPayload()).targets!;
    expect(targets).toHaveLength(2);
    expect(targets.find((t) => t.role === "buy_set")!.target_value).toEqual({
      category_ids: [c1, c2],
    });
    expect(targets.find((t) => t.role === "get_set")!.target_value).toEqual({
      category_ids: [c3],
    });
  });

  it("REGRESSION F27 (bogo): a multi-id buy set + get set survive an untouched Save", async () => {
    // Same silent-scope-loss path as multibuy, on the already-live rule kind:
    // hydrate a 2+2 promotion, touch nothing, Save.
    const [c1, c2] = H.CATEGORY_IDS;
    const [p1, p2] = H.PRODUCT_IDS;
    H.promotionData.current = {
      ...SAVED_BOGO,
      targets: [
        {
          id: "t-buy",
          target_kind: "category",
          target_value: { category_ids: [c1, c2] },
          inclusion: true,
          role: "buy_set",
        },
        {
          id: "t-get",
          target_kind: "product",
          target_value: { product_ids: [p1, p2] },
          inclusion: true,
          role: "get_set",
        },
      ],
    };
    renderForm("/marketing/promotions/promo-bogo-1/edit");
    await waitFor(() => expect(screen.getByTestId("picker-buy")).toBeTruthy());
    // Hydrated into BOTH pickers, in full.
    expect(screen.getByTestId("picker-buy").dataset.categories).toBe(
      `${c1},${c2}`,
    );
    expect(screen.getByTestId("picker-get").dataset.products).toBe(
      `${p1},${p2}`,
    );
    submit();

    const targets = (await updatePayload()).targets!;
    expect(targets).toHaveLength(2);
    expect(targets.find((t) => t.role === "buy_set")!.target_value).toEqual({
      category_ids: [c1, c2],
    });
    expect(targets.find((t) => t.role === "get_set")!.target_value).toEqual({
      product_ids: [p1, p2],
    });
  });

  it("editing ONLY the name keeps a multi-id BOGO scope intact", async () => {
    // The realistic trigger for the original bug: the merchant never opened
    // the targeting card at all.
    const [c1, c2] = H.CATEGORY_IDS;
    H.promotionData.current = {
      ...SAVED_BOGO,
      targets: [
        {
          id: "t-buy",
          target_kind: "category",
          target_value: { category_ids: [c1, c2] },
          inclusion: true,
          role: "buy_set",
        },
      ],
    };
    renderForm("/marketing/promotions/promo-bogo-1/edit");
    await waitFor(() => expect(screen.getByTestId("picker-buy")).toBeTruthy());
    setInput("promo-name", "Buy 2 get 1 — renamed");
    submit();

    const payload = await updatePayload();
    expect(payload.name).toBe("Buy 2 get 1 — renamed");
    expect(payload.targets![0].target_value).toEqual({
      category_ids: [c1, c2],
    });
  });

  it("a get-set alone (buy = any) still emits only the get row", async () => {
    renderForm();
    setInput("promo-name", "Give-away only");
    applyTemplate("bogo_2_1_free");
    fireEvent.click(screen.getByTestId("picker-get-product-1"));
    fireEvent.click(screen.getByTestId("picker-get-product-2"));
    submit();

    const targets = (await createPayload()).targets!;
    expect(targets).toHaveLength(1);
    expect(targets[0].role).toBe("get_set");
    expect(targets[0].target_value).toEqual({
      product_ids: [H.PRODUCT_IDS[0], H.PRODUCT_IDS[1]],
    });
  });

  it("emptying the buy set on an edit drops ONLY that row", async () => {
    const [c1, c2] = H.CATEGORY_IDS;
    H.promotionData.current = {
      ...SAVED_BOGO,
      targets: [
        {
          id: "t-buy",
          target_kind: "category",
          target_value: { category_ids: [c1, c2] },
          inclusion: true,
          role: "buy_set",
        },
        {
          id: "t-get",
          target_kind: "product",
          target_value: { product_ids: [H.PRODUCT_IDS[0]] },
          inclusion: true,
          role: "get_set",
        },
      ],
    };
    renderForm("/marketing/promotions/promo-bogo-1/edit");
    await waitFor(() => expect(screen.getByTestId("picker-buy")).toBeTruthy());
    fireEvent.click(screen.getByTestId("picker-buy-category-1")); // off
    fireEvent.click(screen.getByTestId("picker-buy-category-2")); // off
    submit();

    const targets = (await updatePayload()).targets!;
    expect(targets).toHaveLength(1);
    expect(targets[0].role).toBe("get_set");
  });

  it("an audience target coexists with a multi-id set, both surviving a Save", async () => {
    // `buildTargets` pushes the audience row first and the role-tagged set
    // rows after. Driven through the hydrate path because the audience input
    // is a Radix Select (no native <select> to fire on in jsdom).
    const [c1, c2] = H.CATEGORY_IDS;
    H.promotionData.current = {
      ...SAVED_BOGO,
      targets: [
        {
          id: "t-aud",
          target_kind: "audience",
          target_value: { kind: "returning" },
          inclusion: true,
          role: null,
        },
        {
          id: "t-buy",
          target_kind: "category",
          target_value: { category_ids: [c1, c2] },
          inclusion: true,
          role: "buy_set",
        },
      ],
    };
    renderForm("/marketing/promotions/promo-bogo-1/edit");
    await waitFor(() => expect(screen.getByTestId("picker-buy")).toBeTruthy());
    submit();

    const targets = (await updatePayload()).targets!;
    expect(targets).toHaveLength(2);
    // Audience first, untagged; the set row after, role-tagged and complete.
    expect(targets[0]).toEqual({
      target_kind: "audience",
      target_value: { kind: "returning" },
      inclusion: true,
    });
    expect(targets[1].role).toBe("buy_set");
    expect(targets[1].target_value).toEqual({ category_ids: [c1, c2] });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. Validation — the API's ge=2 / gt=0 boundaries, surfaced in the form
// ─────────────────────────────────────────────────────────────────────────

describe("C. multibuy validation", () => {
  const QTY_ERROR = en.promotions.errors.multibuy_quantity_required;
  const PRICE_ERROR = en.promotions.errors.multibuy_price_required;

  function expectBlocked(message: string) {
    expect(H.createMutateAsync).not.toHaveBeenCalled();
    expect(H.toastError).toHaveBeenCalledWith(message);
    // Guard against asserting a raw i18n key rather than real copy.
    expect(message).not.toMatch(/^promotions\./);
    expect(message.length).toBeGreaterThan(0);
  }

  it("N blank → multibuy_quantity_required", () => {
    renderForm();
    setInput("promo-name", "Trio");
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-qty", "");
    submit();
    expectBlocked(QTY_ERROR);
  });

  it("BOUNDARY N = 1 → multibuy_quantity_required", () => {
    renderForm();
    setInput("promo-name", "Trio");
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-qty", "1");
    submit();
    expectBlocked(QTY_ERROR);
  });

  it("N = 0 and N negative → multibuy_quantity_required", () => {
    for (const value of ["0", "-3"]) {
      vi.clearAllMocks();
      const { unmount } = renderForm();
      setInput("promo-name", "Trio");
      applyTemplate("multibuy_3_for_650");
      setInput("rule-multibuy-qty", value);
      submit();
      expectBlocked(QTY_ERROR);
      unmount();
    }
  });

  it("P blank → multibuy_price_required", () => {
    renderForm();
    setInput("promo-name", "Trio");
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-price", "");
    submit();
    expectBlocked(PRICE_ERROR);
  });

  it("BOUNDARY P = 0 → multibuy_price_required", () => {
    renderForm();
    setInput("promo-name", "Trio");
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-price", "0");
    submit();
    expectBlocked(PRICE_ERROR);
  });

  it("P negative → multibuy_price_required", () => {
    renderForm();
    setInput("promo-name", "Trio");
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-price", "-1");
    submit();
    expectBlocked(PRICE_ERROR);
  });

  it("FRACTIONAL N = 3.5 → multibuy_quantity_required (was the API-422 hole)", () => {
    // `multibuy_quantity: int` on the Python side — a fractional N 422s with
    // a raw pydantic message ("Input should be a valid integer, got a number
    // with a fractional part"), re-verified against the live validator this
    // run. Before `Number.isInteger`, the form let 3.5 through with N >= 2
    // AND the preview quoted a saving for it. Reachable past the input's
    // native step={1} by paste or programmatic state.
    renderForm();
    setInput("promo-name", "Three and a half");
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-qty", "3.5");
    submit();
    expectBlocked(QTY_ERROR);
  });

  it("FRACTIONAL P = 650.5 → multibuy_price_required", () => {
    // Same class on the price field: cents are integers end-to-end, and
    // `multibuy_price_cents: int` rejects the fractional part too.
    renderForm();
    setInput("promo-name", "Six fifty and a half");
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-price", "650.5");
    submit();
    expectBlocked(PRICE_ERROR);
  });

  it.each(MULTIBUY_PYTHON_TYPE_REJECTS.map((r) => [r.id, r] as const))(
    "every shape the Python validator type-rejects is blocked here: %s",
    (_id, reject) => {
      // Data-driven off the live validator's own answers, so the hub's
      // guard is provably a mirror of the API's and not an approximation.
      expect(reject.rejectedByPython).toBe(true);
      expect(reject.pythonError).toContain("valid integer");
      renderForm();
      setInput("promo-name", "Fractional");
      applyTemplate("multibuy_3_for_650");
      setInput("rule-multibuy-qty", reject.typed.quantity);
      setInput("rule-multibuy-price", reject.typed.price);
      submit();
      expectBlocked(reject.field === "quantity" ? QTY_ERROR : PRICE_ERROR);
    },
  );

  it.each(MULTIBUY_PYTHON_TYPE_ACCEPTS.map((a) => [a.id, a] as const))(
    "and the hub is not STRICTER than the API: %s still submits",
    async (_id, accept) => {
      // pydantic coerces an integral float; `Number.isInteger` agrees.
      // A regex-based fix (/^\d+$/) would have diverged the other way.
      renderForm();
      setInput("promo-name", "Integral float");
      applyTemplate("multibuy_3_for_650");
      setInput("rule-multibuy-qty", accept.typed.quantity);
      setInput("rule-multibuy-price", accept.typed.price);
      submit();
      expect(H.toastError).not.toHaveBeenCalled();
      expect((await createPayload()).discount_rule).toEqual({
        kind: "multibuy",
        ...accept.coercedTo,
      });
    },
  );

  it("plain integers across the range still pass", async () => {
    for (const [n, p] of [
      ["2", "1"],
      ["3", "65000"],
      ["10", "999999"],
    ] as const) {
      vi.clearAllMocks();
      H.createMutateAsync.mockResolvedValue({ id: "new-promo" });
      const { unmount } = renderForm();
      setInput("promo-name", "Integers");
      applyTemplate("multibuy_3_for_650");
      setInput("rule-multibuy-qty", n);
      setInput("rule-multibuy-price", p);
      submit();
      expect((await createPayload()).discount_rule).toEqual({
        kind: "multibuy",
        multibuy_quantity: Number(n),
        multibuy_price_cents: Number(p),
      });
      expect(H.toastError).not.toHaveBeenCalled();
      unmount();
    }
  });

  it("BOUNDARY N = 2, P = 1 (the API's ge=2 / gt=0 edges) passes", async () => {
    renderForm();
    setInput("promo-name", "Two for a piaster");
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-qty", "2");
    setInput("rule-multibuy-price", "1");
    submit();

    expect(await createPayload()).toBeTruthy();
    expect(H.toastError).not.toHaveBeenCalled();
    expect((await createPayload()).discount_rule).toEqual({
      kind: "multibuy",
      multibuy_quantity: 2,
      multibuy_price_cents: 1,
    });
  });

  it("the two error messages are distinct so the merchant knows which field", () => {
    expect(QTY_ERROR).not.toBe(PRICE_ERROR);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D. Templates + edit round-trip
// ─────────────────────────────────────────────────────────────────────────

describe("D. templates and edit round-trip", () => {
  it('the "3 for EGP 650" chip prefills kind + N=3 + P=65000', () => {
    renderForm();
    applyTemplate("multibuy_3_for_650");
    expect(inputValue("rule-multibuy-qty")).toBe("3");
    expect(inputValue("rule-multibuy-price")).toBe("65000");
    // The multibuy fields only render for the multibuy kind, so their
    // presence is itself proof the kind switched.
    expect(document.getElementById("rule-multibuy-qty")).toBeTruthy();
  });

  it('the "2 for EGP 500" chip prefills N=2 + P=50000', () => {
    renderForm();
    applyTemplate("multibuy_2_for_500");
    expect(inputValue("rule-multibuy-qty")).toBe("2");
    expect(inputValue("rule-multibuy-price")).toBe("50000");
  });

  it("a multibuy chip clears any leftover bogo/tiered prefill", () => {
    renderForm();
    applyTemplate("bogo_2_1_half");
    applyTemplate("multibuy_3_for_650");
    // BOGO inputs are gone from the DOM entirely.
    expect(document.getElementById("rule-buy-qty")).toBeNull();
    expect(inputValue("rule-multibuy-qty")).toBe("3");
  });

  it("editing a saved multibuy promotion hydrates both numbers", async () => {
    H.promotionData.current = SAVED_MULTIBUY;
    renderForm("/marketing/promotions/promo-multibuy-1/edit");
    await waitFor(() =>
      expect(document.getElementById("rule-multibuy-qty")).toBeTruthy(),
    );
    expect(inputValue("rule-multibuy-qty")).toBe("3");
    expect(inputValue("rule-multibuy-price")).toBe("65000");
    expect(inputValue("promo-name")).toBe("Ultimate Trio");
  });

  it("editing hydrates the eligible set back into the picker", async () => {
    H.promotionData.current = SAVED_MULTIBUY;
    renderForm("/marketing/promotions/promo-multibuy-1/edit");
    await waitFor(() =>
      expect(screen.getByTestId("picker-eligible")).toBeTruthy(),
    );
    const picker = screen.getByTestId("picker-eligible");
    expect(picker.dataset.mode).toBe("category");
    expect(picker.dataset.categories).toBe(H.CATEGORY_ID);
  });

  it("ROUND TRIP: hydrate → submit reproduces the same rule + target", async () => {
    H.promotionData.current = SAVED_MULTIBUY;
    renderForm("/marketing/promotions/promo-multibuy-1/edit");
    await waitFor(() =>
      expect(document.getElementById("rule-multibuy-qty")).toBeTruthy(),
    );
    submit();

    const payload = await updatePayload();
    expect(payload.version).toBe(SAVED_MULTIBUY.version);
    expect(payload.discount_rule).toEqual(SAVED_MULTIBUY.discount_rule);
    // Same target, minus the server-assigned id.
    expect(payload.targets).toEqual([
      {
        target_kind: "category",
        target_value: { category_ids: [H.CATEGORY_ID] },
        inclusion: true,
        role: "buy_set",
      },
    ]);
    expect(H.createMutateAsync).not.toHaveBeenCalled();
  });

  it("ROUND TRIP: an 'any product' multibuy stays target-free", async () => {
    H.promotionData.current = { ...SAVED_MULTIBUY, targets: [] };
    renderForm("/marketing/promotions/promo-multibuy-1/edit");
    await waitFor(() =>
      expect(document.getElementById("rule-multibuy-qty")).toBeTruthy(),
    );
    submit();

    const payload = await updatePayload();
    expect(payload.targets).toEqual([]);
    expect(payload.discount_rule).toEqual(SAVED_MULTIBUY.discount_rule);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D (cont). Targets left over from another kind must not survive the switch
// ─────────────────────────────────────────────────────────────────────────

describe("D2. kind switching does not strand targets", () => {
  it("bogo → multibuy drops the get_set target entirely", async () => {
    // A get_set on a multibuy promotion is meaningless to the engine
    // (`_multibuy` ignores `get_filter`), so leaving one behind would be
    // dead data the merchant can neither see nor remove.
    renderForm();
    setInput("promo-name", "Switcheroo");
    applyTemplate("bogo_2_1_free");
    fireEvent.click(screen.getByTestId("picker-buy-category-1"));
    fireEvent.click(screen.getByTestId("picker-get-product-1"));
    applyTemplate("multibuy_3_for_650");
    fireEvent.click(screen.getByTestId("picker-eligible-category-1"));
    submit();

    const targets = (await createPayload()).targets!;
    expect(targets).toHaveLength(1);
    expect(targets[0].role).toBe("buy_set");
    expect(targets.some((t) => t.role === "get_set")).toBe(false);
  });

  it("KNOWN GAP: an untagged saved target is dropped when the form re-saves", async () => {
    // Pre-existing hub behaviour for EVERY rule kind, not new in WS3: the
    // hydrator only decomposes role-tagged targets and `buildTargets`
    // rebuilds the list from form state, so a promotion carrying an
    // untagged (eligibility-gate) or geo/customer_tag target created via
    // the API loses it on the next hub save. Asserted so the loss is
    // visible; flip this expectation if/when the form round-trips
    // untouched targets.
    H.promotionData.current = {
      ...SAVED_MULTIBUY,
      targets: [
        {
          id: "target-untagged",
          target_kind: "category",
          target_value: { category_ids: [H.CATEGORY_ID] },
          inclusion: true,
          role: null,
        },
      ],
    };
    renderForm("/marketing/promotions/promo-multibuy-1/edit");
    await waitFor(() =>
      expect(document.getElementById("rule-multibuy-qty")).toBeTruthy(),
    );
    // Not hydrated into the picker — so it is NOT silently re-tagged
    // buy_set either, which would turn a gate into a line filter.
    expect(screen.getByTestId("picker-eligible").dataset.mode).toBe("any");
    submit();
    expect((await updatePayload()).targets).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E. Bilingual — the AR dashboard is NUMU's primary locale
// ─────────────────────────────────────────────────────────────────────────

describe("E. multibuy in Arabic", () => {
  it("renders the multibuy field labels and help text in masri", async () => {
    await i18n.changeLanguage("ar");
    renderForm();
    applyTemplate("multibuy_3_for_650");

    const M = ar.promotions.form;
    expect(screen.getByText(M.multibuy_quantity)).toBeInTheDocument();
    expect(screen.getByText(M.multibuy_price)).toBeInTheDocument();
    expect(screen.getByText(M.multibuy_help)).toBeInTheDocument();
    expect(screen.getByText(M.multibuy_targeting_title)).toBeInTheDocument();
    expect(screen.getByText(M.multibuy_eligible_set)).toBeInTheDocument();
    expect(screen.getByText(M.multibuy_eligible_help)).toBeInTheDocument();
    // No raw i18n keys leaked into the rendered form.
    expect(form().textContent).not.toMatch(/promotions\.form\./);
  });

  it("blocks with the ARABIC validation message", async () => {
    await i18n.changeLanguage("ar");
    renderForm();
    setInput("promo-name", "الباقة");
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-qty", "1");
    submit();
    expect(H.toastError).toHaveBeenCalledWith(
      ar.promotions.errors.multibuy_quantity_required,
    );
    expect(H.createMutateAsync).not.toHaveBeenCalled();
  });

  it("GAP CLOSED: the preview explanation renders in Arabic, not English", async () => {
    // Was: `previewDiscount().explanation` was an untranslated English
    // sentence rendered verbatim. `PreviewResult` now carries an
    // `explanation_key`, and PromotionRulePreview renders
    // t(`promotions.form.preview_explain.${key}`) with the English sentence
    // only as `defaultValue`. On the flagship chip this line is the merchant's
    // whole explanation of the number, so it has to be in their language.
    await i18n.changeLanguage("ar");
    renderForm();
    applyTemplate("multibuy_3_for_650");
    const preview = screen.getByTestId("promotion-rule-preview");

    // The derived cart fires, so the applied-bundle sentence is the one on
    // screen — interpolated, in masri.
    const expected = ar.promotions.form.preview_explain.multibuy_applied
      .replace("{{quantity}}", "3")
      .replace("{{cents}}", "65000")
      .replace("{{groups}}", "1");
    expect(preview.textContent).toContain(expected);
    expect(preview.textContent).toContain("باقة"); // written in Arabic, not transliterated

    // The English fallback must NOT be what rendered…
    expect(preview.textContent).not.toContain("3 for 65000 cents");
    expect(preview.textContent).not.toContain("group(s)");
    expect(preview.textContent).not.toContain("bundle(s)");
    // …and no raw i18n key leaked through a missing translation.
    expect(preview.textContent).not.toMatch(/promotions\.form\.preview_explain/);
    expect(preview.textContent).not.toMatch(/promotions\.form\./);
  });

  it("GAP CLOSED: the multibuy MID-TYPING zero state is Arabic", async () => {
    // The 0-discount states are where the sentence matters most — it is the
    // only thing telling the merchant why nothing happened.
    //
    // Since the F25 fix this is the ONLY zero state a multibuy rule can
    // reach through the pane without a cap/minimum: the derived cart is
    // guaranteed to fire, so `multibuy_not_below` and `multibuy_needs` are
    // no longer renderable here (asserted as an invariant below, and in
    // preview-discount.test.ts). The other kinds still have theirs — see
    // the next test.
    await i18n.changeLanguage("ar");
    renderForm();
    applyTemplate("multibuy_3_for_650");
    const preview = screen.getByTestId("promotion-rule-preview");

    setInput("rule-multibuy-qty", ""); // N cleared → "not configured"
    expect(preview.textContent).toContain(
      ar.promotions.form.preview_explain.multibuy_not_configured,
    );
    expect(preview.textContent).not.toContain("multibuy not configured");
    expect(preview.textContent).toContain("−0 EGP");

    setInput("rule-multibuy-qty", "3"); // …and back to a firing rule
    expect(preview.textContent).not.toContain("−0 EGP");
  });

  it("GAP CLOSED: the OTHER kinds' zero-discount explanations are Arabic too", async () => {
    // Re-pointed off multibuy (which can no longer reach a bundle-failure
    // state) onto two kinds that legitimately still can — both driven
    // through real template chips and inputs, not a synthetic rule.
    await i18n.changeLanguage("ar");

    // (a) bogo whose buy quantity the 4-item sample cart can't reach.
    const bogo = renderForm();
    applyTemplate("bogo_2_1_free");
    setInput("rule-buy-qty", "5"); // bundle of 6 > 4 sample units
    let preview = screen.getByTestId("promotion-rule-preview");
    expect(preview.textContent).toContain(
      ar.promotions.form.preview_explain.bogo_not_met,
    );
    expect(preview.textContent).not.toContain("bogo not met");
    expect(preview.textContent).toContain("−0 EGP");
    bogo.unmount();

    // (b) tiered whose lowest threshold (EGP 1000) is above the fixed
    //     sample cart's EGP 280 subtotal.
    renderForm();
    applyTemplate("spend_1000_off_10");
    preview = screen.getByTestId("promotion-rule-preview");
    expect(preview.textContent).toContain(
      ar.promotions.form.preview_explain.tiered_none,
    );
    expect(preview.textContent).not.toContain("no tier threshold met");
    expect(preview.textContent).toContain("−0 EGP");
  });

  it("INVARIANT: the multibuy pane never renders a bundle-failure state (AR + EN)", async () => {
    // The component-level half of the invariant proved exhaustively in
    // preview-discount.test.ts. Driven across a spread of N/P through the
    // real inputs, including the two corners that used to fail: the
    // EGP 1.00–1.19 rounding band (F25a) and P < N (F25b).
    for (const lang of ["ar", "en"] as const) {
      await i18n.changeLanguage(lang);
      const strings = (lang === "ar" ? ar : en).promotions.form.preview_explain;
      const guard = strings.multibuy_not_below.split("{{")[0];
      const needs = strings.multibuy_needs.split("{{")[0];

      for (const [n, p] of [
        ["3", "65000"],
        ["3", "330"], // former F25a band
        ["5", "4"], // former F25b corner
        ["2", "1"],
        ["12", "1439"],
      ] as const) {
        const { unmount } = renderForm();
        applyTemplate("multibuy_3_for_650");
        setInput("rule-multibuy-qty", n);
        setInput("rule-multibuy-price", p);
        const text = screen.getByTestId("promotion-rule-preview").textContent!;
        expect(text, `${lang} N=${n} P=${p}`).not.toContain(guard);
        expect(text, `${lang} N=${n} P=${p}`).not.toContain(needs);
        // The applied-bundle sentence is what renders instead.
        expect(text, `${lang} N=${n} P=${p}`).toContain(
          strings.multibuy_applied.split("{{")[0],
        );
        unmount();
      }
    }
  });

  it("REGRESSION F26: a sub-EGP saving prints its real value, not −0 EGP", () => {
    // F25a made N=3/P=330 fire a real 3-cent discount at the engine level,
    // but the pane formatted money with `(cents / 100).toFixed(0)`, so
    // anything under 50 cents still printed "−0 EGP" — the merchant in that
    // band saw the very "saves nothing" output F25a existed to remove.
    //
    // `PromotionRulePreview` now routes every amount through `egp()`, which
    // drops to 2 decimals only when whole pounds would round a real amount
    // away to zero. Readability is unchanged for normal figures; a genuine
    // saving is never displayed as nothing.
    renderForm();
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-qty", "3");
    setInput("rule-multibuy-price", "330");
    const text = screen.getByTestId("promotion-rule-preview").textContent!;

    // It fired…
    expect(text).toContain(
      en.promotions.form.preview_explain.multibuy_applied
        .replace("{{quantity}}", "3")
        .replace("{{cents}}", "330")
        .replace("{{groups}}", "1"),
    );
    // …and now says so: 3 × 111 − 330 = 3 cents.
    expect(text).toContain("−0.03 EGP");
    expect(text).not.toContain("−0 EGP");
  });

  it("REGRESSION F26 (cont): whole-pound figures keep their clean formatting", () => {
    // The fix must not turn every number into 2dp noise — that would trade
    // one readability problem for another across the whole pane.
    renderForm();
    applyTemplate("multibuy_3_for_650");
    const text = screen.getByTestId("promotion-rule-preview").textContent!;
    // Derived cart: 4 × EGP 271, subtotal 1084, discount 163, total 921.
    expect(text).toContain("271 EGP");
    expect(text).toContain("1084 EGP");
    expect(text).toContain("−163 EGP");
    expect(text).toContain("921 EGP");
    expect(text).not.toContain("271.00");
    expect(text).not.toContain("163.00");
  });

  it("the break-even line renders in Arabic with the interpolated price", async () => {
    await i18n.changeLanguage("ar");
    renderForm();
    applyTemplate("multibuy_3_for_650");
    const preview = screen.getByTestId("promotion-rule-preview");
    // floor(65000 / 3) = 21666 cents → EGP 216.66
    expect(preview.textContent).toContain("216.66");
    expect(preview.textContent).toContain(
      ar.promotions.form.preview_break_even.split("{{price}}")[0],
    );
    expect(preview.textContent).not.toContain("Applies to items priced above");
  });

  it("the sample-cart label counts the DERIVED cart, in Arabic", async () => {
    // The label used to hardcode "4-item"; it now interpolates {{count}}.
    // N=5 ⇒ a 6-item derived cart, so a stale hardcoded label is visible.
    await i18n.changeLanguage("ar");
    renderForm();
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-qty", "5");
    setInput("rule-multibuy-price", "150000");
    const preview = screen.getByTestId("promotion-rule-preview");
    expect(preview.textContent).toContain(
      ar.promotions.form.preview_sample_label.replace("{{count}}", "6"),
    );
    expect(preview.textContent).not.toContain(
      ar.promotions.form.preview_sample_label.replace("{{count}}", "4"),
    );
    // i18next treats `count` as a plural selector; Arabic has six forms and
    // this key declares none, so the base key must still resolve.
    expect(preview.textContent).not.toMatch(/preview_sample_label/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Preview pane — what the merchant is told about their own offer
// ─────────────────────────────────────────────────────────────────────────

describe("live preview pane", () => {
  it("the flagship 3-for-650 chip previews a REAL saving out of the box", () => {
    // Was: the fixed 100/80/60/40 EGP sample cart could never afford a
    // realistically-priced bundle, so this preset previewed as a flat −0
    // and read as broken on first click. The pane now derives its cart from
    // the rule (`sampleCartFor`), so the first thing a merchant sees is the
    // offer working. Cheap-guard coverage moved to the unit level, where it
    // can be provoked deliberately — see preview-discount.test.ts,
    // "the cheap guard on an explicitly cheap cart".
    renderForm();
    applyTemplate("multibuy_3_for_650");
    const preview = screen.getByTestId("promotion-rule-preview");

    // break-even floor(65000/3) = 21666c → 25% up, rounded to a whole
    // pound = EGP 271 × 4 units. One trio = 81300c, minus 65000 = 16300c.
    expect(preview.textContent).toContain("sample 4-item cart");
    expect(preview.textContent).toContain("1084 EGP"); // subtotal, 4 × 271
    expect(preview.textContent).toContain("−163 EGP"); // the saving
    expect(preview.textContent).toContain("921 EGP"); // total = 650 + 271
    expect(preview.textContent).not.toContain("−0 EGP");
    expect(preview.textContent).toContain(
      en.promotions.form.preview_explain.multibuy_applied
        .replace("{{quantity}}", "3")
        .replace("{{cents}}", "65000")
        .replace("{{groups}}", "1"),
    );
  });

  it("prints the break-even so a −0 preview would answer its own question", () => {
    renderForm();
    applyTemplate("multibuy_3_for_650");
    const preview = screen.getByTestId("promotion-rule-preview");
    expect(preview.textContent).toContain(
      en.promotions.form.preview_break_even.replace("{{price}}", "216.66"),
    );
  });

  it("the derived cart tracks N: a 5-item bundle previews 6 sample items", () => {
    renderForm();
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-qty", "5");
    setInput("rule-multibuy-price", "150000");
    const preview = screen.getByTestId("promotion-rule-preview");
    // break-even 30000c → 25% up = EGP 375 × 6 units = 2250 EGP subtotal;
    // one group of 5 = 187500c, minus 150000 = 37500c saving.
    expect(preview.textContent).toContain("sample 6-item cart");
    expect(preview.textContent).toContain("2250 EGP");
    expect(preview.textContent).toContain("−375 EGP");
    expect(preview.textContent).not.toContain("sample 4-item cart");
  });

  it("non-multibuy kinds still preview against the FIXED 100/80/60/40 cart", () => {
    // The derived cart is multibuy-only; changing it for the other kinds
    // would silently reprice every other preview in the form.
    renderForm();
    applyTemplate("bogo_2_1_free");
    const preview = screen.getByTestId("promotion-rule-preview");
    expect(preview.textContent).toContain("sample 4-item cart");
    expect(preview.textContent).toContain("280 EGP"); // 100+80+60+40 subtotal
    expect(preview.textContent).toContain("−40 EGP"); // cheapest unit free
    // …and no break-even line, which only makes sense for a bundle.
    expect(preview.textContent).not.toContain(
      en.promotions.form.preview_break_even.split("{{price}}")[0],
    );
  });

  it("shows a real saving with LOCALIZED copy, not the engine's raw sentence", () => {
    // The pane renders t(`…preview_explain.${key}`), so the visible words
    // are the EN i18n string ("bundle(s)"), not `explanation` ("group(s)").
    renderForm();
    applyTemplate("multibuy_3_for_650");
    setInput("rule-multibuy-qty", "3");
    setInput("rule-multibuy-price", "20000");
    const preview = screen.getByTestId("promotion-rule-preview");
    expect(preview.textContent).toContain("3 for 20000 cents — 1 bundle(s)");
    expect(preview.textContent).not.toContain("group(s)");
    // break-even floor(20000/3) = 6666c → 25% up, rounded = EGP 83 × 4.
    expect(preview.textContent).toContain("−49 EGP"); // 3×8300 − 20000
    expect(preview.textContent).toContain("332 EGP"); // subtotal
  });
});
