/**
 * PromotionForm — scoping a percentage / fixed discount to a catalogue.
 *
 * "20% off Bags" was impossible before this: the form offered no catalogue
 * picker for these rule kinds, and the only shape the API could have received
 * — an untagged catalog target — is an eligibility GATE, which discounts the
 * WHOLE cart whenever one bag is in it.
 *
 * So the load-bearing assertion here is the same one the multibuy suite
 * guards: `role: "buy_set"` on the emitted target. Without that tag the
 * merchant's "20% off Bags" silently becomes "20% off everything, as long as
 * a bag is in the cart" — a discount several times larger than the one they
 * configured, with nothing in the UI to reveal it.
 *
 * Mocked at module boundaries only, mirroring PromotionForm.multibuy.test.tsx.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import i18n from "@/i18n";
import en from "@/i18n/en";
import type { CreatePromotionRequest } from "@/services/promotionApi";

const H = vi.hoisted(() => {
  const STORE_ID = "11111111-1111-4111-8111-111111111111";
  const CATEGORY_ID = "22222222-2222-4222-8222-222222222222";
  const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";
  return {
    STORE_ID,
    CATEGORY_ID,
    PRODUCT_ID,
    createMutateAsync: vi.fn(),
    updateMutateAsync: vi.fn(),
    createCoupon: vi.fn(),
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

vi.mock("@/services/couponApi", () => ({ createCoupon: H.createCoupon }));

vi.mock("@/hooks/usePromotions", () => ({
  usePromotion: () => ({ data: undefined, isLoading: false }),
  useCreatePromotion: () => ({ mutateAsync: H.createMutateAsync }),
  useUpdatePromotion: () => ({ mutateAsync: H.updateMutateAsync }),
}));

vi.mock("@/components/marketing/BogoSetPicker", () => ({
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
    <div data-testid={`picker-${props.side}`} data-mode={props.mode}>
      <button
        type="button"
        data-testid={`picker-${props.side}-pick-category`}
        onClick={() =>
          props.onChange({
            mode: "category",
            productIds: [],
            categoryIds: [H.CATEGORY_ID],
          })
        }
      />
      <button
        type="button"
        data-testid={`picker-${props.side}-pick-product`}
        onClick={() =>
          props.onChange({
            mode: "product",
            productIds: [H.PRODUCT_ID],
            categoryIds: [],
          })
        }
      />
    </div>
  ),
}));

import PromotionForm from "../PromotionForm";

if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
}

function renderForm(entry = "/marketing/promotions/new?surface=automatic") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/marketing/promotions/new" element={<PromotionForm />} />
        <Route path="/marketing/promotions" element={<div>list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const submit = () =>
  fireEvent.submit(document.querySelector("form") as HTMLFormElement);

function setInput(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement;
  expect(el, `#${id} should be rendered`).toBeTruthy();
  fireEvent.change(el, { target: { value } });
}

async function createPayload(): Promise<CreatePromotionRequest> {
  await waitFor(() => expect(H.createMutateAsync).toHaveBeenCalled());
  return H.createMutateAsync.mock.calls.at(-1)![0] as CreatePromotionRequest;
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("en");
});

describe("scoping a percentage discount", () => {
  it("offers the picker for percentage (the default rule kind)", () => {
    renderForm();
    expect(screen.getByTestId("picker-eligible")).toBeTruthy();
  });

  it("emits the category as a buy_set target, not an eligibility gate", async () => {
    renderForm();
    setInput("promo-name", "20% off bags");
    setInput("rule-percent", "20");
    fireEvent.click(screen.getByTestId("picker-eligible-pick-category"));
    submit();

    const payload = await createPayload();
    expect(payload.discount_rule).toMatchObject({
      kind: "percentage",
      value_percent: 20,
    });
    const target = (payload.targets ?? []).find(
      (t) => t.target_kind === "category",
    );
    expect(target, "a category target must be sent").toBeTruthy();
    // The tag is the whole feature: role-tagged = line filter (discount the
    // bags), untagged = gate (discount everything when a bag is present).
    expect(target!.role).toBe("buy_set");
    expect(target!.target_value).toEqual({ category_ids: [H.CATEGORY_ID] });
    expect(target!.inclusion).toBe(true);
  });

  it("emits products the same way", async () => {
    renderForm();
    setInput("promo-name", "20% off this shelf");
    setInput("rule-percent", "20");
    fireEvent.click(screen.getByTestId("picker-eligible-pick-product"));
    submit();

    const payload = await createPayload();
    const target = (payload.targets ?? []).find(
      (t) => t.target_kind === "product",
    );
    expect(target!.role).toBe("buy_set");
    expect(target!.target_value).toEqual({ product_ids: [H.PRODUCT_ID] });
  });

  it("sends no catalog target when the merchant leaves it store-wide", async () => {
    renderForm();
    setInput("promo-name", "20% off everything");
    setInput("rule-percent", "20");
    submit();

    const payload = await createPayload();
    const catalog = (payload.targets ?? []).filter(
      (t) => t.target_kind === "product" || t.target_kind === "category",
    );
    // No target at all — the engine reads that as "the whole cart", which is
    // what every offer written before scoping existed already does.
    expect(catalog).toHaveLength(0);
  });

  it("warns in the live preview that the sample cart is not scoped", () => {
    // The preview cart has no catalogue behind it, so it cannot model which
    // of its items qualify. Quoting its figure unqualified is how a merchant
    // ends up expecting a discount several times the real one.
    const note = en.promotions.form.scope_preview_note;
    renderForm();
    setInput("rule-percent", "20");
    expect(screen.queryByText(note)).toBeNull();
    fireEvent.click(screen.getByTestId("picker-eligible-pick-category"));
    expect(screen.getByText(note)).toBeTruthy();
  });
});
