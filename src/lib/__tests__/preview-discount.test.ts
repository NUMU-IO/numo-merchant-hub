/**
 * `previewDiscount()` — the merchant builder's live-preview math.
 *
 * The stated contract of this module is: "the number the merchant sees is
 * the same number the storefront will charge". That makes drift from the
 * Python engine the ONLY failure that really matters here, so the suite is
 * built in two halves:
 *
 *   1. Explicit, hand-reasoned cases (readable spec, §4/§5 of
 *      docs/Plans/OFFER-VIONNE.md) — these say what the numbers mean.
 *   2. A generated parity sweep against the real Python engine
 *      (`multibuy-python-vectors.ts`) — this proves the numbers are right.
 *
 * After the parity sweep come the module's OTHER two exports, added when the
 * preview pane started deriving its own cart: `multibuyBreakEvenCents` and
 * `sampleCartFor`. They are not parity surface — the Python engine has no
 * equivalent — so their contract is defined here alone. That is precisely
 * why the break-even BOUNDARY is tested rather than assumed: the pane prints
 * that number to the merchant as a precise, checkable promise.
 *
 * Test design order per the QA methodology: happy path → validation →
 * boundaries → guards/errors → shared modifiers → regression.
 */

import { describe, expect, it } from "vitest";

import {
  multibuyBreakEvenCents,
  previewDiscount,
  sampleCartFor,
  SAMPLE_PREVIEW_CART,
  type PreviewLine,
} from "@/lib/preview-discount";
import type { DiscountRule } from "@/services/promotionApi";
import {
  MULTIBUY_PYTHON_REJECTS,
  MULTIBUY_PYTHON_VECTORS,
  OTHER_KIND_PYTHON_VECTORS,
} from "./multibuy-python-vectors";

/** The vionne offer: 3 items for EGP 650. */
const TRIO: DiscountRule = {
  kind: "multibuy",
  multibuy_quantity: 3,
  multibuy_price_cents: 65000,
};

const units = (priceCents: number, count: number): PreviewLine[] =>
  Array.from({ length: count }, () => ({
    unit_price_cents: priceCents,
    quantity: 1,
  }));

const line = (priceCents: number, quantity = 1): PreviewLine => ({
  unit_price_cents: priceCents,
  quantity,
});

// ─────────────────────────────────────────────────────────────────────────
// A. multibuy on the sample cart — what the merchant sees first
// ─────────────────────────────────────────────────────────────────────────

describe("previewDiscount — multibuy on SAMPLE_PREVIEW_CART", () => {
  it("the sample cart is 4 units at 10000/8000/6000/4000 cents", () => {
    // Pinned because every expectation below is reasoned from it.
    expect(SAMPLE_PREVIEW_CART).toEqual([
      { unit_price_cents: 10000, quantity: 1 },
      { unit_price_cents: 8000, quantity: 1 },
      { unit_price_cents: 6000, quantity: 1 },
      { unit_price_cents: 4000, quantity: 1 },
    ]);
  });

  it('"3 for EGP 650" against the sample cart yields NO discount (cheap guard)', () => {
    // Units desc = [10000, 8000, 6000]; group sum 24000 <= 65000, so the
    // bundle would cost the shopper MORE than regular price. The engine
    // refuses; so must the preview.
    const result = previewDiscount(TRIO, SAMPLE_PREVIEW_CART);
    expect(result.discount_cents).toBe(0);
    expect(result.free_shipping).toBe(false);
    expect(result.explanation).toBe(
      "multibuy price (65000 cents) is not below the regular price of 3 items",
    );
  });

  it("a group price BELOW the sample cart's trio does fire", () => {
    // Sanity counterpart to the guard: same cart, P=10000 (N=2).
    // g1 = 18000 > 10000 → +8000; g2 = 10000 <= 10000 → stop.
    const result = previewDiscount(
      { kind: "multibuy", multibuy_quantity: 2, multibuy_price_cents: 10000 },
      SAMPLE_PREVIEW_CART,
    );
    expect(result.discount_cents).toBe(8000);
    expect(result.explanation).toBe("2 for 10000 cents — 1 group(s)");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// A (cont). multibuy happy path + group repetition — exact cents
// ─────────────────────────────────────────────────────────────────────────

describe("previewDiscount — multibuy group math", () => {
  it("3 units at 25000 → 10000 (75000 − 65000)", () => {
    expect(previewDiscount(TRIO, units(25000, 3)).discount_cents).toBe(10000);
  });

  it("4 units → still one group → 10000", () => {
    expect(previewDiscount(TRIO, units(25000, 4)).discount_cents).toBe(10000);
  });

  it("5 units → still one group → 10000", () => {
    expect(previewDiscount(TRIO, units(25000, 5)).discount_cents).toBe(10000);
  });

  it("6 units → two groups → 20000", () => {
    const result = previewDiscount(TRIO, units(25000, 6));
    expect(result.discount_cents).toBe(20000);
    expect(result.explanation).toBe("3 for 65000 cents — 2 group(s)");
  });

  it("7 units → two groups → 20000", () => {
    expect(previewDiscount(TRIO, units(25000, 7)).discount_cents).toBe(20000);
  });

  it("counts UNITS not lines — one line with quantity 3 is a valid trio", () => {
    const result = previewDiscount(TRIO, [line(25000, 3)]);
    expect(result.discount_cents).toBe(10000);
    expect(result.explanation).toBe("3 for 65000 cents — 1 group(s)");
  });

  it("expands quantities and then sorts across lines", () => {
    // [30000 ×2, 25000 ×1, 20000 ×3] → desc 30/30/25/20/20/20.
    // g1 = 85000 → +20000; g2 = 60000 <= 65000 → stop.
    expect(
      previewDiscount(TRIO, [line(30000, 2), line(25000), line(20000, 3)])
        .discount_cents,
    ).toBe(20000);
  });

  it("mixed prices group the MOST EXPENSIVE units (customer-optimal)", () => {
    // §4 matrix: [300, 300, 250, 200] EGP → 850 − 650 = 200 EGP.
    expect(
      previewDiscount(TRIO, [
        line(30000),
        line(30000),
        line(25000),
        line(20000),
      ]).discount_cents,
    ).toBe(20000);
  });

  it("sorts descending regardless of cart order", () => {
    // Naive (unsorted) grouping of this cart gives 15000; correct is 20000.
    const cart = [
      line(20000),
      line(30000),
      line(30000),
      line(25000),
      line(20000),
      line(20000),
    ];
    expect(previewDiscount(TRIO, cart).discount_cents).toBe(20000);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// A (cont). Guards + boundaries
// ─────────────────────────────────────────────────────────────────────────

describe("previewDiscount — multibuy guards and boundaries", () => {
  it("skips the whole second group when it isn't cheaper (partial guard)", () => {
    // [30,30,30,20,20,20]k → g1 90000 → +25000; g2 60000 <= 65000 → stop.
    // NOT 25000 + something: the guard drops the group entirely.
    const result = previewDiscount(TRIO, [line(30000, 3), line(20000, 3)]);
    expect(result.discount_cents).toBe(25000);
    expect(result.explanation).toBe("3 for 65000 cents — 1 group(s)");
  });

  it("BOUNDARY: group sum exactly equal to P yields 0 (<= stops)", () => {
    expect(
      previewDiscount(TRIO, [line(25000), line(25000), line(15000)])
        .discount_cents,
    ).toBe(0);
  });

  it("BOUNDARY: group sum one cent above P yields exactly 1 cent", () => {
    expect(
      previewDiscount(TRIO, [line(25000), line(25000), line(15001)])
        .discount_cents,
    ).toBe(1);
  });

  it("BOUNDARY: N−1 units → 0 with the 'needs N' explanation", () => {
    const result = previewDiscount(TRIO, units(25000, 2));
    expect(result.discount_cents).toBe(0);
    expect(result.explanation).toBe(
      "multibuy needs 3 eligible items, cart has 2",
    );
  });

  it("empty cart → 0", () => {
    expect(previewDiscount(TRIO, []).discount_cents).toBe(0);
  });

  it("three cheap units below the bundle price → 0 (never worse than regular)", () => {
    expect(previewDiscount(TRIO, units(20000, 3)).discount_cents).toBe(0);
  });

  it("N=2 / P=1 (the API's ge=2 / gt=0 boundaries) is a valid, firing rule", () => {
    expect(
      previewDiscount(
        { kind: "multibuy", multibuy_quantity: 2, multibuy_price_cents: 1 },
        units(25000, 2),
      ).discount_cents,
    ).toBe(49999);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// A (cont). Not configured — the form's in-progress states
// ─────────────────────────────────────────────────────────────────────────

describe("previewDiscount — multibuy not configured", () => {
  const notConfigured = "multibuy not configured";

  it("N missing → 0 with 'not configured'", () => {
    const result = previewDiscount(
      { kind: "multibuy", multibuy_price_cents: 65000 },
      units(25000, 3),
    );
    expect(result.discount_cents).toBe(0);
    expect(result.explanation).toBe(notConfigured);
  });

  it("N = 1 → 0 (a bundle of one is not a bundle)", () => {
    const result = previewDiscount(
      { kind: "multibuy", multibuy_quantity: 1, multibuy_price_cents: 65000 },
      units(25000, 3),
    );
    expect(result.discount_cents).toBe(0);
    expect(result.explanation).toBe(notConfigured);
  });

  it("N = 0 and negative N → 0", () => {
    for (const n of [0, -3]) {
      expect(
        previewDiscount(
          { kind: "multibuy", multibuy_quantity: n, multibuy_price_cents: 65000 },
          units(25000, 3),
        ).discount_cents,
      ).toBe(0);
    }
  });

  it("P missing / 0 / negative → 0 with 'not configured'", () => {
    for (const p of [undefined, 0, -100]) {
      const result = previewDiscount(
        { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: p },
        units(25000, 3),
      );
      expect(result.discount_cents).toBe(0);
      expect(result.explanation).toBe(notConfigured);
    }
  });

  it("nulls (the API's on-the-wire shape for absent fields) → 0", () => {
    const result = previewDiscount(
      { kind: "multibuy", multibuy_quantity: null, multibuy_price_cents: null },
      units(25000, 3),
    );
    expect(result.discount_cents).toBe(0);
    expect(result.explanation).toBe(notConfigured);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// A (cont). Shared modifiers — cap + minimum
// ─────────────────────────────────────────────────────────────────────────

describe("previewDiscount — multibuy with shared modifiers", () => {
  it("max_discount_cents clamps the total", () => {
    expect(
      previewDiscount(
        { ...TRIO, max_discount_cents: 15000 },
        units(25000, 6),
      ).discount_cents,
    ).toBe(15000); // raw would be 20000
  });

  it("max_discount_cents = 0 zeroes the discount", () => {
    expect(
      previewDiscount({ ...TRIO, max_discount_cents: 0 }, units(25000, 3))
        .discount_cents,
    ).toBe(0);
  });

  it("a cap above the raw discount is a no-op", () => {
    expect(
      previewDiscount({ ...TRIO, max_discount_cents: 999999 }, units(25000, 3))
        .discount_cents,
    ).toBe(10000);
  });

  it("min_subtotal_cents above the subtotal short-circuits to 0", () => {
    const result = previewDiscount(
      { ...TRIO, min_subtotal_cents: 100000 },
      units(25000, 3),
    );
    expect(result.discount_cents).toBe(0);
    expect(result.explanation).toBe("subtotal below minimum (100000 cents)");
  });

  it("BOUNDARY: subtotal exactly equal to the minimum still applies", () => {
    expect(
      previewDiscount({ ...TRIO, min_subtotal_cents: 75000 }, units(25000, 3))
        .discount_cents,
    ).toBe(10000);
  });

  it("BOUNDARY: subtotal one cent short of the minimum → 0", () => {
    expect(
      previewDiscount({ ...TRIO, min_subtotal_cents: 75001 }, units(25000, 3))
        .discount_cents,
    ).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// A (cont). THE cross-check — TS preview vs the real Python engine
// ─────────────────────────────────────────────────────────────────────────

describe("previewDiscount — TS/Python parity (multibuy)", () => {
  it("has a non-trivial generated vector set", () => {
    expect(MULTIBUY_PYTHON_VECTORS.length).toBeGreaterThanOrEqual(30);
  });

  it.each(MULTIBUY_PYTHON_VECTORS.map((v) => [v.id, v] as const))(
    "matches the Python engine: %s",
    (_id, vec) => {
      const result = previewDiscount(vec.rule, vec.lines);
      expect(result.discount_cents).toBe(vec.pythonDiscountCents);
      // Neither side may invent free shipping out of a multibuy rule.
      expect(result.free_shipping).toBe(false);
      // Sanity: a discount can never exceed the cart it discounts.
      expect(result.discount_cents).toBeLessThanOrEqual(vec.subtotalCents);
    },
  );

  it("CONTAINED DIVERGENCE: a fractional N is still priced here, but can no longer be submitted", () => {
    // Python: `multibuy_quantity: int` -> "Input should be a valid integer,
    // got a number with a fractional part" (re-verified against the live
    // validator this run, for N=3.5 AND P=650.5). The TS preview has no
    // such guard: it truncates via Array.slice and quotes a saving the
    // engine can never deliver.
    //
    // `previewDiscount` is deliberately left permissive — it prices whatever
    // the in-progress form hands it. The divergence is closed one layer up:
    // `PromotionForm.validate()` now rejects non-integer N and P
    // (`Number.isInteger`), so nothing fractional reaches the API. That
    // block is asserted in PromotionForm.multibuy.test.tsx ("C. multibuy
    // validation" → fractional N / P). This test pins the engine half so a
    // future "let's just floor it" change is a visible decision.
    const result = previewDiscount(
      { kind: "multibuy", multibuy_quantity: 3.5, multibuy_price_cents: 65000 },
      units(30000, 7),
    );
    expect(result.discount_cents).toBe(80000);
    expect(result.explanation).toBe("3.5 for 65000 cents — 2 group(s)");
  });

  it("every rule shape the Python validator rejects is one the preview also refuses to price", () => {
    // The preview can be handed an in-progress (invalid) rule by the form;
    // it must return 0, never an optimistic number the API would then 422.
    for (const reject of MULTIBUY_PYTHON_REJECTS) {
      expect(reject.rejectedByPython).toBe(true);
      const rule = { kind: "multibuy", ...reject.kwargs } as DiscountRule;
      expect(previewDiscount(rule, units(25000, 6)).discount_cents).toBe(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// The break-even helper — the number the pane makes a promise about
// ─────────────────────────────────────────────────────────────────────────

const multibuy = (n?: number | null, p?: number | null): DiscountRule => ({
  kind: "multibuy",
  multibuy_quantity: n,
  multibuy_price_cents: p,
});

describe("multibuyBreakEvenCents", () => {
  it("is floor(P / N)", () => {
    expect(multibuyBreakEvenCents(multibuy(2, 50000))).toBe(25000);
    expect(multibuyBreakEvenCents(multibuy(5, 150000))).toBe(30000);
    expect(multibuyBreakEvenCents(multibuy(10, 65000))).toBe(6500);
  });

  it("FLOORS a non-divisible P: 65000 / 3 → 21666, not 21666.67", () => {
    // Rounding UP here would be a lie in the merchant's favour: the pane
    // would advertise a threshold at which the offer still refuses to fire.
    expect(multibuyBreakEvenCents(TRIO)).toBe(21666);
    expect(multibuyBreakEvenCents(multibuy(3, 65002))).toBe(21667);
    expect(multibuyBreakEvenCents(multibuy(7, 100))).toBe(14);
  });

  it("null when N is unconfigured (missing / 0 / 1 / negative)", () => {
    expect(multibuyBreakEvenCents({ kind: "multibuy", multibuy_price_cents: 65000 }))
      .toBeNull();
    for (const n of [0, 1, -3]) {
      expect(multibuyBreakEvenCents(multibuy(n, 65000)), `N=${n}`).toBeNull();
    }
  });

  it("null when P is unconfigured (missing / 0 / negative)", () => {
    expect(multibuyBreakEvenCents({ kind: "multibuy", multibuy_quantity: 3 }))
      .toBeNull();
    for (const p of [0, -100]) {
      expect(multibuyBreakEvenCents(multibuy(3, p)), `P=${p}`).toBeNull();
    }
  });

  it("null on the API's on-the-wire nulls", () => {
    expect(multibuyBreakEvenCents(multibuy(null, null))).toBeNull();
  });

  it("BOUNDARY: N=2 / P=1 is legal but floors to a break-even of 0", () => {
    // 0, not null — the rule IS configured, its break-even is just below
    // one cent. Distinguishing the two matters: `null` hides the pane's
    // break-even line, `0` prints "above EGP 0.00", which is true.
    expect(multibuyBreakEvenCents(multibuy(2, 1))).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// THE BOUNDARY the pane's copy promises out loud
// ─────────────────────────────────────────────────────────────────────────

describe("break-even boundary — 'applies to items priced above EGP X each'", () => {
  // `promotions.form.preview_break_even` makes a precise, checkable claim to
  // the merchant. These tests are that claim, executed.
  const atBreakEven = (rule: DiscountRule) => {
    const n = rule.multibuy_quantity!;
    const be = multibuyBreakEvenCents(rule)!;
    return {
      at: previewDiscount(rule, units(be, n)).discount_cents,
      above: previewDiscount(rule, units(be + 1, n)).discount_cents,
    };
  };

  it("N items priced exactly AT the break-even do NOT trigger the offer", () => {
    // 3 × 21666 = 64998 ≤ 65000 → the cheap guard holds. "Above", not
    // "at or above", is therefore the correct word in the copy.
    expect(previewDiscount(TRIO, units(21666, 3)).discount_cents).toBe(0);
    expect(previewDiscount(TRIO, units(21666, 3)).explanation_key).toBe(
      "multibuy_not_below",
    );
  });

  it("N items ONE CENT above the break-even DO trigger it", () => {
    // 3 × 21667 = 65001 → exactly 1 cent of discount. The threshold is
    // reachable, not merely asymptotic.
    const result = previewDiscount(TRIO, units(21667, 3));
    expect(result.discount_cents).toBe(1);
    expect(result.explanation_key).toBe("multibuy_applied");
  });

  it.each([
    [2, 50000],
    [2, 1],
    [3, 65000],
    [3, 65001],
    [3, 65002],
    [3, 20000],
    [4, 100000],
    [5, 150000],
    [6, 25000],
    [7, 100],
    [10, 65000],
    [12, 500000],
  ])("holds with no off-by-one for N=%i P=%i", (n, p) => {
    const { at, above } = atBreakEven(multibuy(n, p));
    expect(at, `N=${n} P=${p} priced AT break-even`).toBe(0);
    expect(above, `N=${n} P=${p} priced 1c ABOVE break-even`).toBeGreaterThan(0);
  });

  it("the figure the pane prints is the exact threshold, not a rounded one", () => {
    // The break-even is whole cents, so its major-unit value is exact — an
    // item priced at the printed figure is genuinely the last one that does
    // NOT fire. The component formats this exact value (`moneyExact`); the
    // rendered string is pinned in PromotionForm.multibuy.test.tsx.
    const be = multibuyBreakEvenCents(TRIO)!;
    expect(be).toBe(21666);
    expect(be / 100).toBe(216.66);
    expect(previewDiscount(TRIO, units(be, 3)).discount_cents).toBe(0);
    expect(previewDiscount(TRIO, units(be + 1, 3)).discount_cents).toBe(1);
  });

  it("WHY the printed figure may not be rounded to whole major units", () => {
    // Executes the reason the pane formats the threshold exactly. Rounding to
    // whole units breaks the copy's promise in BOTH directions, so neither
    // `Math.round` nor `toFixed(0)` is an acceptable formatter here.
    //
    // (a) Rounding UP excludes prices that DO qualify.
    const upBe = multibuyBreakEvenCents(TRIO)!; // 21666 → "217" if rounded
    expect(Math.round(upBe / 100)).toBe(217);
    // 216.67 is above the true threshold and fires, yet a "above EGP 217"
    // sentence tells the merchant it would not.
    expect(previewDiscount(TRIO, units(21667, 3)).discount_cents).toBeGreaterThan(0);

    // (b) Rounding DOWN is worse: it NAMES a price that does not qualify —
    // the exact F24 failure mode.
    const downRule = multibuy(3, 64890); // break-even 21630 → "216" if rounded
    const downBe = multibuyBreakEvenCents(downRule)!;
    expect(downBe).toBe(21630);
    expect(Math.round(downBe / 100)).toBe(216);
    // An item at EGP 216.10 is "above EGP 216" but buys nothing.
    expect(previewDiscount(downRule, units(21610, 3)).discount_cents).toBe(0);
    // Whereas the exact figure never lies: at it 0, one cent above it > 0.
    expect(previewDiscount(downRule, units(downBe, 3)).discount_cents).toBe(0);
    expect(
      previewDiscount(downRule, units(downBe + 1, 3)).discount_cents,
    ).toBeGreaterThan(0);
  });

  it("the guard is per GROUP, so a below-threshold group is skipped whole", () => {
    // Six units: the dearer trio clears the break-even, the cheaper one
    // sits exactly on it. Only the first group pays out.
    const result = previewDiscount(TRIO, [
      ...units(21667, 3),
      ...units(21666, 3),
    ]);
    expect(result.discount_cents).toBe(1);
    expect(result.explanation).toBe("3 for 65000 cents — 1 group(s)");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// sampleCartFor — the cart the preview pane actually prices
// ─────────────────────────────────────────────────────────────────────────

const NON_MULTIBUY_RULES: [string, DiscountRule][] = [
  ["percentage", { kind: "percentage", value_percent: 10 }],
  ["fixed", { kind: "fixed", value_cents: 5000 }],
  ["free_shipping", { kind: "free_shipping" }],
  ["bogo", { kind: "bogo", buy_quantity: 2, get_quantity: 1 }],
  ["tiered", { kind: "tiered", tiers: [{ threshold_cents: 1, percent: 10 }] }],
  ["unknown kind", { kind: "quantity_break" as DiscountRule["kind"] }],
];

describe("sampleCartFor — non-multibuy kinds keep the fixed cart", () => {
  it.each(NON_MULTIBUY_RULES)(
    "%s gets the SAMPLE_PREVIEW_CART itself (same reference)",
    (_label, rule) => {
      // `toBe`, not `toEqual`: an accidental copy would still deep-equal
      // while quietly making the "fixed cart" claim un-provable.
      expect(sampleCartFor(rule)).toBe(SAMPLE_PREVIEW_CART);
    },
  );

  it("stray multibuy fields on another kind do NOT derive a cart", () => {
    // The kind is checked first; leftover form state must not change the
    // cart a percentage rule is previewed against.
    expect(
      sampleCartFor({
        kind: "percentage",
        value_percent: 10,
        multibuy_quantity: 3,
        multibuy_price_cents: 65000,
      }),
    ).toBe(SAMPLE_PREVIEW_CART);
  });
});

describe("sampleCartFor — malformed multibuy falls back to the fixed cart", () => {
  const MALFORMED: [string, DiscountRule][] = [
    ["N missing", { kind: "multibuy", multibuy_price_cents: 65000 }],
    ["N = 1", multibuy(1, 65000)],
    ["N = 0", multibuy(0, 65000)],
    ["N negative", multibuy(-3, 65000)],
    ["P missing", { kind: "multibuy", multibuy_quantity: 3 }],
    ["P = 0", multibuy(3, 0)],
    ["P negative", multibuy(3, -100)],
    ["both null (on-the-wire)", multibuy(null, null)],
    ["bare rule", { kind: "multibuy" }],
  ];

  it.each(MALFORMED)("%s → SAMPLE_PREVIEW_CART", (_label, rule) => {
    expect(sampleCartFor(rule)).toBe(SAMPLE_PREVIEW_CART);
  });

  it("the fallback keeps the preview honest: still 0, still 'not configured'", () => {
    const rule = multibuy(1, 65000);
    const result = previewDiscount(rule, sampleCartFor(rule));
    expect(result.discount_cents).toBe(0);
    expect(result.explanation_key).toBe("multibuy_not_configured");
  });
});

describe("sampleCartFor — a valid multibuy derives its own cart", () => {
  const unitFor = (n: number, p: number) =>
    Math.max(100, Math.round((Math.floor(p / n) * 1.25) / 100) * 100);

  it("N+1 equal-priced units for the flagship 3-for-650", () => {
    const cart = sampleCartFor(TRIO);
    expect(cart).not.toBe(SAMPLE_PREVIEW_CART);
    expect(cart).toHaveLength(4); // N + 1
    // 25% above the 21666 break-even, rounded to a whole pound: EGP 271.
    expect(cart).toEqual(units(27100, 4));
  });

  it("N = 2 → 3 units", () => {
    const cart = sampleCartFor(multibuy(2, 50000));
    expect(cart).toHaveLength(3);
    expect(new Set(cart.map((l) => l.unit_price_cents)).size).toBe(1);
    expect(cart[0].unit_price_cents).toBe(unitFor(2, 50000)); // 31300
    expect(cart.every((l) => l.quantity === 1)).toBe(true);
  });

  it("N = 5 → 6 units", () => {
    const cart = sampleCartFor(multibuy(5, 150000));
    expect(cart).toHaveLength(6);
    expect(new Set(cart.map((l) => l.unit_price_cents)).size).toBe(1);
    expect(cart[0].unit_price_cents).toBe(unitFor(5, 150000)); // 37500
  });

  it.each([2, 3, 4, 5, 6, 8, 10, 12])("N = %i yields exactly N+1 units", (n) => {
    const cart = sampleCartFor(multibuy(n, n * 25000));
    expect(cart).toHaveLength(n + 1);
    expect(cart.reduce((s, l) => s + l.quantity, 0)).toBe(n + 1);
  });

  it("every unit is priced max(100, round(breakEven × 1.25 / 100) × 100)", () => {
    for (const [n, p] of [
      [2, 50000],
      [3, 65000],
      [3, 20000],
      [5, 150000],
      [10, 65000],
      [3, 297], // break-even 99 → the max(100, …) floor bites
    ] as const) {
      const cart = sampleCartFor(multibuy(n, p));
      for (const li of cart) {
        expect(li.unit_price_cents, `N=${n} P=${p}`).toBe(unitFor(n, p));
      }
      // Whole pounds — the preview should read like a real price tag.
      expect(cart[0].unit_price_cents % 100, `N=${n} P=${p}`).toBe(0);
    }
  });

  it("does not mutate or alias the fixed sample cart", () => {
    const before = JSON.parse(JSON.stringify(SAMPLE_PREVIEW_CART));
    const cart = sampleCartFor(TRIO);
    cart[0].unit_price_cents = 1;
    expect(SAMPLE_PREVIEW_CART).toEqual(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// The derived cart's whole purpose: it must FIRE
// ─────────────────────────────────────────────────────────────────────────

describe("sampleCartFor — the derived cart fires the offer", () => {
  it.each([
    [2, 50000],
    [2, 100],
    [3, 65000],
    [3, 20000],
    [3, 297], // break-even 99 — the max(100, …) floor is the binding term
    [3, 330], // break-even 110 — inside the old F25a rounding band
    [3, 360], // break-even 120 — just above it
    [5, 4], // P < N — break-even 0, the old F25b fallback corner
    [4, 100000],
    [5, 150000],
    [6, 25000],
    [8, 400000],
    [10, 65000],
    [12, 500000],
  ])("N=%i P=%i previews a real, non-zero saving", (n, p) => {
    const rule = multibuy(n, p);
    const result = previewDiscount(rule, sampleCartFor(rule));
    expect(result.discount_cents, `N=${n} P=${p}`).toBeGreaterThan(0);
    expect(result.explanation_key).toBe("multibuy_applied");
    expect(result.explanation_params).toMatchObject({ groups: 1 });
  });

  it("shows exactly ONE bundle plus one item at full price", () => {
    // That framing is the pane's entire pedagogical job, so pin the
    // arithmetic: total = bundle price + one full-price unit.
    for (const [n, p] of [
      [2, 50000],
      [3, 65000],
      [5, 150000],
    ] as const) {
      const rule = multibuy(n, p);
      const cart = sampleCartFor(rule);
      const unit = cart[0].unit_price_cents;
      const subtotal = cart.reduce((s, l) => s + l.unit_price_cents * l.quantity, 0);
      const { discount_cents } = previewDiscount(rule, cart);
      expect(discount_cents, `N=${n} P=${p}`).toBe(n * unit - p);
      expect(subtotal - discount_cents, `N=${n} P=${p}`).toBe(p + unit);
    }
  });

  it("REGRESSION F25a: the EGP 1.00–1.19 rounding band now fires", () => {
    // WAS a gap: `round(breakEven × 1.25 / 100) × 100` collapses to 100 for
    // any break-even in [100, 119] (100/80 … 119/80 all round to 1), and the
    // old `max(100, …)` floor could not rescue it because the break-even was
    // already ≥ 100 — so N units × 100 ≤ P and the pane invented a cart it
    // then declared too cheap.
    //
    // FIXED by adding `breakEven + 1` to the floor, which is the whole
    // guarantee in one term: unit ≥ be+1 ⇒ N·unit ≥ N·be + N > P, because
    // P = N·be + r with r ≤ N−1. Rounding can no longer swallow the margin.
    //
    // Sweep the ENTIRE former band, not just the three values that used to
    // fail — a fix that only moved the band would still pass a spot check.
    for (const n of [2, 3, 12]) {
      for (let be = 100; be <= 119; be++) {
        // p = n·be gives exactly this break-even; +(n−1) is the far end of
        // the same break-even's P range, i.e. the worst case for the margin.
        for (const p of [n * be, n * be + (n - 1)]) {
          const rule = multibuy(n, p);
          expect(multibuyBreakEvenCents(rule), `N=${n} P=${p}`).toBe(be);
          const result = previewDiscount(rule, sampleCartFor(rule));
          expect(result.discount_cents, `N=${n} P=${p} be=${be}`).toBeGreaterThan(0);
          expect(result.explanation_key, `N=${n} P=${p}`).toBe("multibuy_applied");
        }
      }
    }
    // The three values that used to fail, named explicitly so the
    // regression is greppable from the defect record.
    for (const [n, p] of [
      [3, 330], // break-even 110
      [2, 200], // break-even 100 — was the first failing value
      [12, 1439], // break-even 119 — was the last failing value
    ] as const) {
      const rule = multibuy(n, p);
      expect(
        previewDiscount(rule, sampleCartFor(rule)).discount_cents,
        `N=${n} P=${p}`,
      ).toBeGreaterThan(0);
    }
  });

  it("REGRESSION F25a (cont): the +1 floor only bites where rounding fell short", () => {
    // Guards the fix against over-correction: outside the old band the unit
    // price must still be the rounded whole-pound figure, because that is
    // what makes the preview read like a real price tag.
    const rounded = (be: number) => Math.round((be * 1.25) / 100) * 100;
    for (const [n, p] of [
      [3, 65000], // be 21666 → rounded 27100, well above be+1
      [2, 50000], // be 25000 → rounded 31300
      [5, 150000], // be 30000 → rounded 37500
    ] as const) {
      const be = multibuyBreakEvenCents(multibuy(n, p))!;
      expect(sampleCartFor(multibuy(n, p))[0].unit_price_cents).toBe(rounded(be));
      expect(rounded(be)).toBeGreaterThan(be + 1);
    }
    // Inside the old band the +1 floor is the term that wins.
    const be = multibuyBreakEvenCents(multibuy(3, 330))!; // 110
    expect(rounded(be)).toBe(100); // the old, too-low value
    expect(sampleCartFor(multibuy(3, 330))[0].unit_price_cents).toBe(be + 1); // 111
  });

  it("REGRESSION F25b: P < N (break-even 0) derives a cart instead of bailing", () => {
    // WAS a gap: `!breakEven` is truthy for a break-even of 0, so a rule with
    // P < N bailed to the 4-item fixed cart — which cannot even form a group
    // once N ≥ 5, leaving the merchant with "needs 5 eligible items, cart
    // has 4". FIXED by testing `breakEven == null` instead of falsiness: 0 is
    // a valid (if absurd) break-even, not an unconfigured one.
    const rule = multibuy(5, 4);
    const cart = sampleCartFor(rule);
    expect(cart).not.toBe(SAMPLE_PREVIEW_CART);
    expect(cart).toHaveLength(6); // N + 1
    // unit = max(100, 0 + 1, round(0) × 100) = 100 — the absolute floor.
    expect(cart).toEqual(units(100, 6));

    const result = previewDiscount(rule, cart);
    expect(result.discount_cents).toBe(5 * 100 - 4); // 496
    expect(result.explanation_key).toBe("multibuy_applied");

    // Sweep the whole degenerate corner: every P < N, for N up to 12.
    for (let n = 2; n <= 12; n++) {
      for (let p = 1; p < n; p++) {
        const r = multibuy(n, p);
        expect(multibuyBreakEvenCents(r), `N=${n} P=${p}`).toBe(0);
        expect(sampleCartFor(r), `N=${n} P=${p}`).not.toBe(SAMPLE_PREVIEW_CART);
        expect(sampleCartFor(r), `N=${n} P=${p}`).toHaveLength(n + 1);
        expect(
          previewDiscount(r, sampleCartFor(r)).discount_cents,
          `N=${n} P=${p}`,
        ).toBe(n * 100 - p);
      }
    }
  });

  it("GUARANTEE: no (N, P) in a wide exhaustive sweep fails to fire", () => {
    // The claim the derived cart exists to make, executed rather than
    // asserted. Both former gaps were found by a scan like this one, so the
    // scan is now permanent: a future tweak to the unit-price formula that
    // reopens a band fails here, not in production.
    //
    // Every valid rule must (a) derive its own cart, never the fixed
    // fallback, (b) derive exactly N+1 units, and (c) produce a strictly
    // positive discount.
    const failures: string[] = [];
    const prices: number[] = [];
    for (let p = 1; p <= 3000; p++) prices.push(p);
    for (let p = 3001; p <= 200000; p += 7) prices.push(p);
    for (let p = 200001; p <= 5_000_000; p += 4999) prices.push(p);

    for (const n of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 25, 100]) {
      for (const p of prices) {
        const rule = multibuy(n, p);
        const cart = sampleCartFor(rule);
        if (cart === SAMPLE_PREVIEW_CART) {
          failures.push(`fixed-cart fallback at N=${n} P=${p}`);
          continue;
        }
        if (cart.length !== n + 1) {
          failures.push(`N=${n} P=${p} derived ${cart.length} units, want ${n + 1}`);
        }
        if (previewDiscount(rule, cart).discount_cents <= 0) {
          failures.push(
            `N=${n} P=${p} be=${multibuyBreakEvenCents(rule)} unit=${cart[0].unit_price_cents} did not fire`,
          );
        }
      }
    }
    expect(failures.slice(0, 20)).toEqual([]);
    expect(failures).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// The invariant that falls out of the F25 fix
// ─────────────────────────────────────────────────────────────────────────

describe("INVARIANT: the multibuy preview cannot render a bundle-failure state", () => {
  // Once the derived cart is guaranteed to fire, two of the engine's
  // explanation branches become unreachable *through the pane*:
  // `multibuy_not_below` (the cheap guard) and `multibuy_needs` (too few
  // items). They remain reachable — and tested — at the unit level with a
  // real cart, which is where they belong. Stating it as an invariant is
  // what makes a future regression loud instead of subtle: if either key
  // ever renders again, the derived cart has stopped doing its job.
  const paneResult = (rule: DiscountRule) =>
    previewDiscount(rule, sampleCartFor(rule));

  it("neither multibuy_not_below nor multibuy_needs is reachable from the pane", () => {
    const leaked: string[] = [];
    for (const n of [2, 3, 4, 5, 6, 8, 10, 12, 25]) {
      for (let p = 1; p <= 4000; p++) {
        const key = paneResult(multibuy(n, p)).explanation_key;
        if (key === "multibuy_not_below" || key === "multibuy_needs") {
          leaked.push(`N=${n} P=${p} → ${key}`);
        }
      }
    }
    expect(leaked.slice(0, 10)).toEqual([]);
    expect(leaked).toHaveLength(0);
  });

  it("a fully-configured, unmodified multibuy rule ALWAYS previews > 0", () => {
    for (const [n, p] of [
      [2, 1],
      [3, 2],
      [5, 4], // P < N
      [3, 330], // the old rounding band
      [3, 65000],
      [10, 1_000_000],
    ] as const) {
      const r = paneResult(multibuy(n, p));
      expect(r.discount_cents, `N=${n} P=${p}`).toBeGreaterThan(0);
      expect(r.explanation_key, `N=${n} P=${p}`).toBe("multibuy_applied");
    }
  });

  it("DEFECT F26 (extent): a firing offer can still PRINT as −0 EGP", () => {
    // The pane formats money as `(discount_cents / 100).toFixed(0)`, so any
    // saving under 50 cents renders "−0 EGP" even though the offer fired.
    // That matters here specifically because the F25a fix floors the derived
    // unit price at `breakEven + 1`, making the margin as small as 1 cent —
    // so the engine-level fix does NOT fully remove the merchant-visible
    // symptom in that band. Measured extent (scan over N ∈ {2…12, 25, 100}
    // × P 1–300 000, 3 000 000 rules): 3469 affected, all with a break-even
    // between 75 and 279 cents, and a discount of at most 49 cents.
    const printed = (cents: number) => (cents / 100).toFixed(0);

    const rule = multibuy(3, 330);
    const result = previewDiscount(rule, sampleCartFor(rule));
    expect(result.discount_cents).toBe(3); // 3 × 111 − 330 — it really fired
    expect(result.explanation_key).toBe("multibuy_applied");
    expect(printed(result.discount_cents)).toBe("0"); // …but prints as zero

    // The band's bounds, so a fix can be verified against them.
    const affected: number[] = [];
    for (const n of [2, 3, 5, 12]) {
      for (let p = 1; p <= 3000; p++) {
        const r = multibuy(n, p);
        const d = previewDiscount(r, sampleCartFor(r)).discount_cents;
        if (d > 0 && printed(d) === "0") affected.push(multibuyBreakEvenCents(r)!);
      }
    }
    expect(affected.length).toBeGreaterThan(0);
    expect(Math.min(...affected)).toBeGreaterThanOrEqual(75);
    expect(Math.max(...affected)).toBeLessThanOrEqual(279);

    // Pane-wide and pre-existing, not specific to multibuy: a small `fixed`
    // rule prints the same way. Recorded so the fix is scoped correctly.
    expect(
      printed(previewDiscount({ kind: "fixed", value_cents: 49 }).discount_cents),
    ).toBe("0");
  });

  it("the zero-discount states that DO remain are only these three", () => {
    // Stated exhaustively so the invariant is honest about its own scope —
    // "never zero" would be false, and a false invariant is worse than none.

    // 1. Mid-typing: the rule isn't configured yet. Must stay reachable —
    //    it is the merchant's feedback while filling the form in.
    const notConfigured = paneResult({ kind: "multibuy", multibuy_quantity: 3 });
    expect(notConfigured.discount_cents).toBe(0);
    expect(notConfigured.explanation_key).toBe("multibuy_not_configured");

    // 2. A minimum-subtotal gate above the derived cart's subtotal. Correct
    //    behaviour: the rule genuinely would not apply to that cart.
    const gated = paneResult({ ...TRIO, min_subtotal_cents: 999_999 });
    expect(gated.discount_cents).toBe(0);
    expect(gated.explanation_key).toBe("below_minimum");

    // 3. A zero discount CAP. Note the explanation still says the bundle
    //    applied, because the cap lands after the guard — so the pane reads
    //    "3 for 65000 cents — 1 bundle(s)" next to "−0 EGP". Pre-existing
    //    for every rule kind (a capped percentage does the same), not
    //    introduced by the derived cart; pinned here so it is a known,
    //    deliberate state rather than a surprise.
    const capped = paneResult({ ...TRIO, max_discount_cents: 0 });
    expect(capped.discount_cents).toBe(0);
    expect(capped.explanation_key).toBe("multibuy_applied");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// The cheap guard, at its proper (unit) altitude
// ─────────────────────────────────────────────────────────────────────────

describe("previewDiscount — the cheap guard on an explicitly cheap cart", () => {
  // This used to be covered incidentally by the preview PANE, because the
  // old fixed 100/80/60/40 cart could never afford a 3-for-650 bundle. The
  // pane now derives a cart that fires, so the guard's coverage lives here
  // — where it can be exercised deliberately instead of by accident.
  it("three items cheaper than the bundle → 0 and the 'not below' key", () => {
    const result = previewDiscount(TRIO, SAMPLE_PREVIEW_CART);
    expect(result.discount_cents).toBe(0);
    expect(result.free_shipping).toBe(false);
    expect(result.explanation).toBe(
      "multibuy price (65000 cents) is not below the regular price of 3 items",
    );
    expect(result.explanation_key).toBe("multibuy_not_below");
  });

  it("the guard's params carry the break-even the merchant needs", () => {
    // The AR/EN copy interpolates {{breakEven}} to answer "so what price
    // WOULD work?". The engine hands the render layer integer MINOR units
    // under a `_cents` name; `PromotionRulePreview` formats them in the
    // store's own currency (see its `moneyExact`). Nothing here is
    // pre-formatted, and nothing here is denominated in a currency.
    const result = previewDiscount(TRIO, SAMPLE_PREVIEW_CART);
    expect(result.explanation_params).toEqual({
      amount_cents: 65000,
      quantity: 3,
      break_even_cents: 21666, // FLOORED — see REGRESSION F24 below
    });
  });

  it("every money param is integer minor units under a _cents name", () => {
    // The `_cents` suffix IS the contract with the render layer: it is what
    // makes an unmapped param a loud bug (a raw "65000" on screen) instead of
    // a quiet 100x one. Asserted across every branch that carries money.
    const moneyBranches: [string, DiscountRule, PreviewLine[]][] = [
      ["below_minimum", { ...TRIO, min_subtotal_cents: 999999 }, units(25000, 3)],
      ["fixed_off", { kind: "fixed", value_cents: 5000 }, SAMPLE_PREVIEW_CART],
      ["multibuy_not_below", TRIO, SAMPLE_PREVIEW_CART],
      ["multibuy_applied", TRIO, units(25000, 3)],
      [
        "tiered_applied",
        { kind: "tiered", tiers: [{ threshold_cents: 20000, percent: 10 }] },
        SAMPLE_PREVIEW_CART,
      ],
    ];
    for (const [key, rule, lines] of moneyBranches) {
      const r = previewDiscount(rule, lines);
      expect(r.explanation_key, `${key} reachable`).toBe(key);
      const params = r.explanation_params!;
      const moneyKeys = Object.keys(params).filter((k) => k.endsWith("_cents"));
      expect(moneyKeys.length, `${key} carries money`).toBeGreaterThan(0);
      for (const k of moneyKeys) {
        expect(typeof params[k], `${key}.${k}`).toBe("number");
        expect(Number.isInteger(params[k] as number), `${key}.${k}`).toBe(true);
      }
      // No param may arrive pre-formatted — that would hardcode a currency
      // inside the engine, which is exactly what the render layer owns.
      for (const v of Object.values(params)) {
        expect(String(v)).not.toMatch(/EGP|ج\.م/);
      }
    }
  });

  it("REGRESSION F24: break_even_cents is FLOORED, so it never names a qualifying price", () => {
    // WAS a defect: `multibuy_not_below` computed `((P / N) / 100).toFixed(2)`
    // — round to nearest — while `multibuyBreakEvenCents` (and the pane's own
    // `preview_break_even` line) floor to whole cents. For the flagship rule
    // the pane printed 216.67 in the guard sentence and 216.66 in the line
    // directly beneath it, and 216.67 is a price that actually DOES qualify
    // (3 × 21667 = 65001 > 65000) — so the copy excluded a working price.
    // FIXED by flooring in the params too.
    //
    // Post-refactor the param is the integer `break_even_cents` rather than a
    // pre-formatted "216.66" string, which makes the guarantee STRONGER: the
    // two figures are now the same number from the same helper, not two
    // strings that happen to match.
    const params = previewDiscount(TRIO, SAMPLE_PREVIEW_CART)
      .explanation_params as Record<string, number>;

    expect(params.break_even_cents).toBe(21666);
    expect(params.break_even_cents).toBe(multibuyBreakEvenCents(TRIO));
    expect(Number.isInteger(params.break_even_cents)).toBe(true);
    // Explicitly NOT the rounded value the old bug produced.
    expect(params.break_even_cents).not.toBe(Math.round(65000 / 3)); // 21667

    // And the figure it names is the true last non-qualifying price: at it,
    // nothing fires; one cent above it, something does.
    expect(previewDiscount(TRIO, units(params.break_even_cents, 3)).discount_cents)
      .toBe(0);
    expect(
      previewDiscount(TRIO, units(params.break_even_cents + 1, 3)).discount_cents,
    ).toBe(1);
  });

  it("REGRESSION F24 (cont): the two printed figures agree UNCONDITIONALLY", () => {
    // The old bug only showed up when P/N had a fractional cent ≥ 0.5, so a
    // spot check on a divisible P would have missed it entirely. Sweep the
    // whole neighbourhood instead: the guard sentence's break-even and the
    // break-even LINE beneath it must never disagree, for any (N, P) that can
    // reach the guard. Both are formatted by one helper in the component, so
    // agreement at the source (integer identity) is agreement on screen — the
    // component test "the printed break-even is the exact threshold" pins the
    // rendered half.
    const disagreements: string[] = [];
    for (const n of [2, 3, 5, 7, 11, 13, 100]) {
      for (let p = 1; p <= 20000; p++) {
        const rule = multibuy(n, p);
        // A cart of N units at one cent each is below any break-even, so it
        // reliably lands on the guard branch.
        const r = previewDiscount(rule, units(1, n));
        if (r.explanation_key !== "multibuy_not_below") continue;
        const sentence = (r.explanation_params as Record<string, number>)
          .break_even_cents;
        const line = multibuyBreakEvenCents(rule);
        if (sentence !== line) {
          disagreements.push(`N=${n} P=${p}: sentence=${sentence} line=${line}`);
        }
      }
    }
    expect(disagreements.slice(0, 10)).toEqual([]);
    expect(disagreements).toHaveLength(0);
  });

  it("REGRESSION F24 (cont): a P divisible by N would NOT have caught the old bug", () => {
    // Kept as an explicit reminder of why the sweep above exists — this is
    // the case that always agreed, before and after the fix.
    const divisible = multibuy(3, 65001); // 21667 exactly
    const r = previewDiscount(divisible, units(1, 3));
    expect((r.explanation_params as Record<string, number>).break_even_cents)
      .toBe(21667);
    expect(multibuyBreakEvenCents(divisible)).toBe(21667);
    // Floor and round agree here — the case that hid the defect.
    expect(Math.round(65001 / 3)).toBe(21667);
  });

  it("the guard fires for any cart under the break-even, derived or not", () => {
    for (const price of [1, 100, 20000, 21666]) {
      const result = previewDiscount(TRIO, units(price, 6));
      expect(result.discount_cents, `unit ${price}`).toBe(0);
      expect(result.explanation_key, `unit ${price}`).toBe("multibuy_not_below");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// F. Regression — the other branches of the shared switch
// ─────────────────────────────────────────────────────────────────────────

describe("previewDiscount — other rule kinds still price identically", () => {
  it.each(OTHER_KIND_PYTHON_VECTORS.map((v) => [v.id, v] as const))(
    "matches the Python engine: %s",
    (_id, vec) => {
      const result = previewDiscount(vec.rule, vec.lines);
      expect(result.discount_cents).toBe(vec.pythonDiscountCents);
      expect(result.free_shipping).toBe(vec.pythonFreeShipping);
    },
  );

  it("percentage explanation is unchanged", () => {
    expect(
      previewDiscount({ kind: "percentage", value_percent: 10 }).explanation,
    ).toBe("10% off");
  });

  it("fixed explanation is unchanged", () => {
    expect(
      previewDiscount({ kind: "fixed", value_cents: 5000 }).explanation,
    ).toBe("5000 cents off");
  });

  it("free_shipping still sets the flag and no cents", () => {
    // Deep-equal on purpose: this is the one place that pins the WHOLE
    // result shape, so a field added to `PreviewResult` has to be
    // acknowledged here rather than sliding in unnoticed. `explanation_key`
    // is the third field (localized-explanations change); `explanation_params`
    // is genuinely absent on this branch — "free shipping" interpolates
    // nothing — and `toEqual` treats a missing key and `undefined` alike, so
    // its absence is asserted explicitly below.
    const result = previewDiscount({ kind: "free_shipping" });
    expect(result).toEqual({
      discount_cents: 0,
      free_shipping: true,
      explanation: "free shipping",
      explanation_key: "free_shipping",
    });
    expect(Object.keys(result).sort()).toEqual([
      "discount_cents",
      "explanation",
      "explanation_key",
      "free_shipping",
    ]);
  });

  it("the English `explanation` text is byte-identical to the pre-i18n engine", () => {
    // The Python-parity vectors are matched on cents, but the English
    // sentences are the human-readable half of the same contract. Adding
    // `explanation_key` must not have reworded a single one of them.
    const cases: [DiscountRule, string][] = [
      [{ kind: "free_shipping" }, "free shipping"],
      [{ kind: "percentage", value_percent: 10 }, "10% off"],
      [{ kind: "fixed", value_cents: 5000 }, "5000 cents off"],
      [
        { kind: "percentage", value_percent: 10, min_subtotal_cents: 999999 },
        "subtotal below minimum (999999 cents)",
      ],
      [
        { kind: "bogo", buy_quantity: 2, get_quantity: 1 },
        "buy 2 get 1 @ 100% off — 1 bundle(s)",
      ],
      [{ kind: "bogo", buy_quantity: 0, get_quantity: 1 }, "bogo not configured"],
      [{ kind: "bogo", buy_quantity: 5, get_quantity: 1 }, "bogo not met"],
      [{ kind: "multibuy" }, "multibuy not configured"],
      [
        { kind: "multibuy", multibuy_quantity: 9, multibuy_price_cents: 100 },
        "multibuy needs 9 eligible items, cart has 4",
      ],
      [TRIO, "multibuy price (65000 cents) is not below the regular price of 3 items"],
      [
        { kind: "multibuy", multibuy_quantity: 2, multibuy_price_cents: 10000 },
        "2 for 10000 cents — 1 group(s)",
      ],
      [
        { kind: "tiered", tiers: [{ threshold_cents: 20000, percent: 10 }] },
        "10% off (tier ≥ 20000 cents)",
      ],
      [
        { kind: "tiered", tiers: [{ threshold_cents: 999999, percent: 10 }] },
        "no tier threshold met",
      ],
      [{ kind: "quantity_break" as DiscountRule["kind"] }, "unknown rule kind"],
    ];
    for (const [rule, sentence] of cases) {
      expect(
        previewDiscount(rule, SAMPLE_PREVIEW_CART).explanation,
        `explanation for kind=${rule.kind}`,
      ).toBe(sentence);
    }
  });

  it("EVERY branch carries a non-empty explanation_key", () => {
    // A branch that forgets its key renders `t("promotions.form.
    // preview_explain.undefined")`, which i18next resolves to the
    // English `defaultValue` — silently un-localizing that one state.
    const rules: DiscountRule[] = [
      { kind: "free_shipping" },
      { kind: "percentage", value_percent: 10 },
      { kind: "fixed", value_cents: 5000 },
      { kind: "percentage", value_percent: 10, min_subtotal_cents: 999999 },
      { kind: "bogo", buy_quantity: 2, get_quantity: 1 },
      { kind: "bogo", buy_quantity: 0, get_quantity: 1 },
      { kind: "bogo", buy_quantity: 5, get_quantity: 1 },
      { kind: "multibuy" },
      { kind: "multibuy", multibuy_quantity: 9, multibuy_price_cents: 100 },
      TRIO,
      { kind: "multibuy", multibuy_quantity: 2, multibuy_price_cents: 10000 },
      { kind: "tiered", tiers: [{ threshold_cents: 20000, percent: 10 }] },
      { kind: "tiered", tiers: [{ threshold_cents: 999999, percent: 10 }] },
      { kind: "quantity_break" as DiscountRule["kind"] },
    ];
    for (const rule of rules) {
      const key = previewDiscount(rule, SAMPLE_PREVIEW_CART).explanation_key;
      expect(typeof key, `kind=${rule.kind}`).toBe("string");
      expect(key.length, `kind=${rule.kind}`).toBeGreaterThan(0);
      // Keys are i18n path segments — a dot would silently nest them.
      expect(key).not.toMatch(/[.\s]/);
    }
  });

  it("bogo explanation is unchanged", () => {
    expect(
      previewDiscount({
        kind: "bogo",
        buy_quantity: 2,
        get_quantity: 1,
        get_discount_percent: 100,
      }).explanation,
    ).toBe("buy 2 get 1 @ 100% off — 1 bundle(s)");
  });

  it("bogo not-configured / not-met branches are unchanged", () => {
    expect(
      previewDiscount({ kind: "bogo", buy_quantity: 0, get_quantity: 1 })
        .explanation,
    ).toBe("bogo not configured");
    expect(
      previewDiscount({ kind: "bogo", buy_quantity: 5, get_quantity: 1 })
        .explanation,
    ).toBe("bogo not met");
  });

  it("tiered explanation is unchanged", () => {
    expect(
      previewDiscount({
        kind: "tiered",
        tiers: [{ threshold_cents: 20000, percent: 10 }],
      }).explanation,
    ).toBe("10% off (tier ≥ 20000 cents)");
    expect(
      previewDiscount({
        kind: "tiered",
        tiers: [{ threshold_cents: 999999, percent: 10 }],
      }).explanation,
    ).toBe("no tier threshold met");
  });

  it("an unknown kind still falls through to a zero discount", () => {
    const result = previewDiscount({
      kind: "quantity_break" as DiscountRule["kind"],
    });
    expect(result.discount_cents).toBe(0);
    expect(result.explanation).toBe("unknown rule kind");
  });

  it("multibuy fields on a non-multibuy rule are ignored", () => {
    // Guards against the switch leaking state between branches.
    expect(
      previewDiscount({
        kind: "percentage",
        value_percent: 10,
        multibuy_quantity: 3,
        multibuy_price_cents: 65000,
      }).discount_cents,
    ).toBe(2800);
  });
});
