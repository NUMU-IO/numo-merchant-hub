/**
 * TS<->Python parity fixture for the MULTIBUY discount rule.
 *
 * GENERATED — do not hand-edit. Every `pythonDiscountCents` below was
 * produced by running the vector through the real engine:
 *   NUMU-api/src/core/value_objects/discount_rule.py::DiscountRule._multibuy
 *
 * Regenerate with (from the NUMU-api repo root):
 *   .venv/Scripts/python.exe <qa scratchpad>/gen_multibuy_vectors.py
 *
 * The hub's `previewDiscount()` exists so "the number the merchant sees is
 * the number the storefront will charge". These vectors are the proof of
 * that claim; a diff here is a real defect on one side or the other, never
 * something to paper over by editing this file.
 *
 * NOTE: the preview has no targeting, so every vector runs the engine's
 * unfiltered ("any-product") path — which is also what the preview pane
 * documents about itself.
 *
 * Last re-verified against the live engine on 2026-07-29: all 32 multibuy
 * rows, all 20 other-kind rows and all 8 domain rejects reproduced exactly,
 * plus a 600-vector randomized sweep (seed 20260729) with zero diffs.
 * `MULTIBUY_PYTHON_TYPE_{REJECTS,ACCEPTS}` were captured in the same run.
 */

import type { DiscountRule } from "@/services/promotionApi";
import type { PreviewLine } from "@/lib/preview-discount";

export interface MultibuyVector {
  id: string;
  note: string;
  rule: DiscountRule;
  lines: PreviewLine[];
  subtotalCents: number;
  /** Ground truth: what the Python engine returned. */
  pythonDiscountCents: number;
  /** Engine-side explanation (differs in wording from the merchant-facing preview). */
  pythonExplanation: string;
}

export const MULTIBUY_PYTHON_VECTORS: MultibuyVector[] = [
  {
    id: "sample_cart_3_for_650",
    note: "SAMPLE_PREVIEW_CART, N=3 P=65000 \u2014 one group sums 24000 <= 65000 => cheap-guard, 0",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 0,
    pythonExplanation: "multibuy price (65000 cents) is not below the regular price of 3 eligible items (any-product)",
  },
  {
    id: "sample_cart_n2_p10000",
    note: "SAMPLE_PREVIEW_CART, N=2 P=10000 \u2014 g1 18000>10000 (+8000), g2 10000<=10000 stop",
    rule: { kind: "multibuy", multibuy_quantity: 2, multibuy_price_cents: 10000 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 8000,
    pythonExplanation: "2 for 10000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "three_units_25000",
    note: "3 units @25000 => 75000-65000 = 10000",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }],
    subtotalCents: 75000,
    pythonDiscountCents: 10000,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "four_units_25000",
    note: "4 units => still one group => 10000",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }],
    subtotalCents: 100000,
    pythonDiscountCents: 10000,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "five_units_25000",
    note: "5 units => one group => 10000",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }],
    subtotalCents: 125000,
    pythonDiscountCents: 10000,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "six_units_25000",
    note: "6 units => two groups => 20000",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }],
    subtotalCents: 150000,
    pythonDiscountCents: 20000,
    pythonExplanation: "3 for 65000 cents \u2014 2 group(s) (any-product)",
  },
  {
    id: "seven_units_25000",
    note: "7 units => two groups => 20000",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }],
    subtotalCents: 175000,
    pythonDiscountCents: 20000,
    pythonExplanation: "3 for 65000 cents \u2014 2 group(s) (any-product)",
  },
  {
    id: "single_line_quantity_3",
    note: "ONE line with quantity 3 is a valid trio (Mix & Match) => 10000",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 25000, quantity: 3 }],
    subtotalCents: 75000,
    pythonDiscountCents: 10000,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "two_lines_quantity_3_each",
    note: "2 lines x qty3 = 6 units => two groups => 20000",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 25000, quantity: 3 }, { unit_price_cents: 25000, quantity: 3 }],
    subtotalCents: 150000,
    pythonDiscountCents: 20000,
    pythonExplanation: "3 for 65000 cents \u2014 2 group(s) (any-product)",
  },
  {
    id: "mixed_quantities_expand_then_sort",
    note: "[30000x2, 25000x1, 20000x3] => desc 30/30/25/20/20/20 => g1 85000-65000, g2 60000 stop",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 30000, quantity: 2 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 20000, quantity: 3 }],
    subtotalCents: 145000,
    pythonDiscountCents: 20000,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "zero_units",
    note: "empty cart => 0",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [],
    subtotalCents: 0,
    pythonDiscountCents: 0,
    pythonExplanation: "multibuy needs 3 eligible items, cart has 0 (any-product)",
  },
  {
    id: "two_units_below_n",
    note: "N-1 units => 0 (needs N)",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }],
    subtotalCents: 50000,
    pythonDiscountCents: 0,
    pythonExplanation: "multibuy needs 3 eligible items, cart has 2 (any-product)",
  },
  {
    id: "n_greater_than_units",
    note: "N=5 with 4 units => 0",
    rule: { kind: "multibuy", multibuy_quantity: 5, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }],
    subtotalCents: 100000,
    pythonDiscountCents: 0,
    pythonExplanation: "multibuy needs 5 eligible items, cart has 4 (any-product)",
  },
  {
    id: "unsorted_input_desc_grouping",
    note: "cart order [20,30,30,25,20,20]k => sorted grouping yields 20000, naive order yields 15000",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 20000, quantity: 1 }, { unit_price_cents: 30000, quantity: 1 }, { unit_price_cents: 30000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 20000, quantity: 1 }, { unit_price_cents: 20000, quantity: 1 }],
    subtotalCents: 145000,
    pythonDiscountCents: 20000,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "mixed_prices_30_30_25_20",
    note: "\u00a74 matrix row: [300,300,250,200] EGP => 850-650 = 200 EGP = 20000 cents",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 30000, quantity: 1 }, { unit_price_cents: 30000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 20000, quantity: 1 }],
    subtotalCents: 105000,
    pythonDiscountCents: 20000,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "partial_guard_second_group_skipped",
    note: "[30,30,30,20,20,20]k => g1 90000-65000=25000; g2 60000<=65000 => stop. Total 25000",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 30000, quantity: 3 }, { unit_price_cents: 20000, quantity: 3 }],
    subtotalCents: 150000,
    pythonDiscountCents: 25000,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "cheap_three_below_group_price",
    note: "3 x 20000 = 60000 < 65000 => 0",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 20000, quantity: 3 }],
    subtotalCents: 60000,
    pythonDiscountCents: 0,
    pythonExplanation: "multibuy price (65000 cents) is not below the regular price of 3 eligible items (any-product)",
  },
  {
    id: "group_sum_exactly_equals_price",
    note: "BOUNDARY: group sum == P => `<=` stops => 0",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 15000, quantity: 1 }],
    subtotalCents: 65000,
    pythonDiscountCents: 0,
    pythonExplanation: "multibuy price (65000 cents) is not below the regular price of 3 eligible items (any-product)",
  },
  {
    id: "group_sum_one_cent_above_price",
    note: "BOUNDARY: group sum == P+1 => discount of exactly 1 cent",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 25000, quantity: 1 }, { unit_price_cents: 15001, quantity: 1 }],
    subtotalCents: 65001,
    pythonDiscountCents: 1,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "n2_p50000_two_units",
    note: "2 for EGP 500 with 2 units @30000 => 10000",
    rule: { kind: "multibuy", multibuy_quantity: 2, multibuy_price_cents: 50000 },
    lines: [{ unit_price_cents: 30000, quantity: 2 }],
    subtotalCents: 60000,
    pythonDiscountCents: 10000,
    pythonExplanation: "2 for 50000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "n2_p50000_four_units_two_groups",
    note: "4 units @30000 => two groups => 20000",
    rule: { kind: "multibuy", multibuy_quantity: 2, multibuy_price_cents: 50000 },
    lines: [{ unit_price_cents: 30000, quantity: 4 }],
    subtotalCents: 120000,
    pythonDiscountCents: 20000,
    pythonExplanation: "2 for 50000 cents \u2014 2 group(s) (any-product)",
  },
  {
    id: "n2_p50000_second_group_guarded",
    note: "[30,30,20,20]k => g1 60000-50000=10000; g2 40000<=50000 stop",
    rule: { kind: "multibuy", multibuy_quantity: 2, multibuy_price_cents: 50000 },
    lines: [{ unit_price_cents: 30000, quantity: 2 }, { unit_price_cents: 20000, quantity: 2 }],
    subtotalCents: 100000,
    pythonDiscountCents: 10000,
    pythonExplanation: "2 for 50000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "n2_p1_minimum_legal_price",
    note: "API boundary P=1 (gt=0): 2 units @25000 => 50000-1 = 49999",
    rule: { kind: "multibuy", multibuy_quantity: 2, multibuy_price_cents: 1 },
    lines: [{ unit_price_cents: 25000, quantity: 2 }],
    subtotalCents: 50000,
    pythonDiscountCents: 49999,
    pythonExplanation: "2 for 1 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "max_discount_clamps",
    note: "6 units @25000 would give 20000; max_discount_cents=15000 clamps",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000, max_discount_cents: 15000 },
    lines: [{ unit_price_cents: 25000, quantity: 6 }],
    subtotalCents: 150000,
    pythonDiscountCents: 15000,
    pythonExplanation: "3 for 65000 cents \u2014 2 group(s) (any-product)",
  },
  {
    id: "max_discount_zero",
    note: "max_discount_cents=0 (legal, ge=0) => 0",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000, max_discount_cents: 0 },
    lines: [{ unit_price_cents: 25000, quantity: 3 }],
    subtotalCents: 75000,
    pythonDiscountCents: 0,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "max_discount_above_raw_is_noop",
    note: "cap higher than the raw discount changes nothing",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000, max_discount_cents: 999999 },
    lines: [{ unit_price_cents: 25000, quantity: 3 }],
    subtotalCents: 75000,
    pythonDiscountCents: 10000,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "min_subtotal_above_subtotal",
    note: "subtotal 75000 < min 100000 => 0 before the math even runs",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000, min_subtotal_cents: 100000 },
    lines: [{ unit_price_cents: 25000, quantity: 3 }],
    subtotalCents: 75000,
    pythonDiscountCents: 0,
    pythonExplanation: "subtotal below minimum (100000 cents)",
  },
  {
    id: "min_subtotal_exactly_met",
    note: "BOUNDARY: subtotal == min => NOT below => discount applies",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000, min_subtotal_cents: 75000 },
    lines: [{ unit_price_cents: 25000, quantity: 3 }],
    subtotalCents: 75000,
    pythonDiscountCents: 10000,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "min_subtotal_one_cent_short",
    note: "BOUNDARY: subtotal == min-1 => 0",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000, min_subtotal_cents: 75001 },
    lines: [{ unit_price_cents: 25000, quantity: 3 }],
    subtotalCents: 75000,
    pythonDiscountCents: 0,
    pythonExplanation: "subtotal below minimum (75001 cents)",
  },
  {
    id: "min_and_max_together",
    note: "both modifiers on the same rule",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000, min_subtotal_cents: 50000, max_discount_cents: 12000 },
    lines: [{ unit_price_cents: 25000, quantity: 6 }],
    subtotalCents: 150000,
    pythonDiscountCents: 12000,
    pythonExplanation: "3 for 65000 cents \u2014 2 group(s) (any-product)",
  },
  {
    id: "large_prices_no_overflow",
    note: "3 units @10,000,000 cents => 30,000,000-65,000",
    rule: { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 10000000, quantity: 3 }],
    subtotalCents: 30000000,
    pythonDiscountCents: 29935000,
    pythonExplanation: "3 for 65000 cents \u2014 1 group(s) (any-product)",
  },
  {
    id: "large_n",
    note: "N=10, 20 units @25000 => two groups of 250000-65000",
    rule: { kind: "multibuy", multibuy_quantity: 10, multibuy_price_cents: 65000 },
    lines: [{ unit_price_cents: 25000, quantity: 20 }],
    subtotalCents: 500000,
    pythonDiscountCents: 370000,
    pythonExplanation: "10 for 65000 cents \u2014 2 group(s) (any-product)",
  },
];

/**
 * Rule shapes the Python domain validator REFUSES to construct. The hub's
 * form validation must block all of these before submit — if one reaches the
 * API it is a 422 the merchant cannot decode.
 */
export interface MultibuyReject {
  id: string;
  kwargs: Record<string, number>;
  rejectedByPython: boolean;
  pythonError: string;
}

export const MULTIBUY_PYTHON_REJECTS: MultibuyReject[] = [
  {
    id: "n_missing",
    kwargs: {"multibuy_price_cents": 65000},
    rejectedByPython: true,
    pythonError: "Value error, multibuy discount requires multibuy_quantity and multibuy_price_cents",
  },
  {
    id: "p_missing",
    kwargs: {"multibuy_quantity": 3},
    rejectedByPython: true,
    pythonError: "Value error, multibuy discount requires multibuy_quantity and multibuy_price_cents",
  },
  {
    id: "both_missing",
    kwargs: {},
    rejectedByPython: true,
    pythonError: "Value error, multibuy discount requires multibuy_quantity and multibuy_price_cents",
  },
  {
    id: "n_equals_1",
    kwargs: {"multibuy_quantity": 1, "multibuy_price_cents": 65000},
    rejectedByPython: true,
    pythonError: "Input should be greater than or equal to 2",
  },
  {
    id: "n_equals_0",
    kwargs: {"multibuy_quantity": 0, "multibuy_price_cents": 65000},
    rejectedByPython: true,
    pythonError: "Input should be greater than or equal to 2",
  },
  {
    id: "n_negative",
    kwargs: {"multibuy_quantity": -3, "multibuy_price_cents": 65000},
    rejectedByPython: true,
    pythonError: "Input should be greater than or equal to 2",
  },
  {
    id: "p_equals_0",
    kwargs: {"multibuy_quantity": 3, "multibuy_price_cents": 0},
    rejectedByPython: true,
    pythonError: "Input should be greater than 0",
  },
  {
    id: "p_negative",
    kwargs: {"multibuy_quantity": 3, "multibuy_price_cents": -1},
    rejectedByPython: true,
    pythonError: "Input should be greater than 0",
  },
];

/**
 * Rule shapes Python rejects on TYPE grounds rather than domain grounds:
 * `multibuy_quantity` / `multibuy_price_cents` are `int`, and pydantic
 * refuses a float carrying a fractional part.
 *
 * Kept separate from `MULTIBUY_PYTHON_REJECTS` because the hub blocks these
 * at a DIFFERENT layer. `previewDiscount()` happily prices a fractional N
 * (it truncates via Array.slice), so the guard lives in
 * `PromotionForm.validate()` (`Number.isInteger`) and is asserted there —
 * feeding this list into the "the preview also refuses to price it" check
 * would be false.
 *
 * `accepted` rows are the mirror image: floats that ARE integral, which
 * pydantic coerces rather than rejects. The hub must not be stricter than
 * the API, so those have to keep passing the form too.
 */
export interface MultibuyTypeReject {
  id: string;
  /** Which form field carries the offending value. */
  field: "quantity" | "price";
  kwargs: Record<string, number>;
  /** What the merchant types, since the form's inputs hold strings. */
  typed: { quantity: string; price: string };
  rejectedByPython: boolean;
  pythonError: string;
}

export const MULTIBUY_PYTHON_TYPE_REJECTS: MultibuyTypeReject[] = [
  {
    id: "n_fractional_3_5",
    field: "quantity",
    kwargs: {"multibuy_quantity": 3.5, "multibuy_price_cents": 65000},
    typed: { quantity: "3.5", price: "65000" },
    rejectedByPython: true,
    pythonError: "Input should be a valid integer, got a number with a fractional part [type=int_from_float, input_value=3.5, input_type=float]",
  },
  {
    id: "n_fractional_2_5",
    field: "quantity",
    kwargs: {"multibuy_quantity": 2.5, "multibuy_price_cents": 65000},
    typed: { quantity: "2.5", price: "65000" },
    rejectedByPython: true,
    pythonError: "Input should be a valid integer, got a number with a fractional part [type=int_from_float, input_value=2.5, input_type=float]",
  },
  {
    id: "n_fractional_2_0001",
    field: "quantity",
    kwargs: {"multibuy_quantity": 2.0001, "multibuy_price_cents": 65000},
    typed: { quantity: "2.0001", price: "65000" },
    rejectedByPython: true,
    pythonError: "Input should be a valid integer, got a number with a fractional part [type=int_from_float, input_value=2.0001, input_type=float]",
  },
  {
    id: "p_fractional_650_5",
    field: "price",
    kwargs: {"multibuy_quantity": 3, "multibuy_price_cents": 650.5},
    typed: { quantity: "3", price: "650.5" },
    rejectedByPython: true,
    pythonError: "Input should be a valid integer, got a number with a fractional part [type=int_from_float, input_value=650.5, input_type=float]",
  },
  {
    id: "p_fractional_0_5",
    field: "price",
    kwargs: {"multibuy_quantity": 3, "multibuy_price_cents": 0.5},
    typed: { quantity: "3", price: "0.5" },
    rejectedByPython: true,
    pythonError: "Input should be a valid integer, got a number with a fractional part [type=int_from_float, input_value=0.5, input_type=float]",
  },
  {
    id: "p_fractional_65000_01",
    field: "price",
    kwargs: {"multibuy_quantity": 3, "multibuy_price_cents": 65000.01},
    typed: { quantity: "3", price: "65000.01" },
    rejectedByPython: true,
    pythonError: "Input should be a valid integer, got a number with a fractional part [type=int_from_float, input_value=65000.01, input_type=float]",
  },
];

/**
 * Integral floats pydantic ACCEPTS and coerces to int. In JS there is no
 * int/float distinction, so what matters is the STRING the merchant types:
 * `Number("3.0") === 3` and `Number.isInteger` agrees, so the hub must not
 * be stricter than the API here.
 */
export const MULTIBUY_PYTHON_TYPE_ACCEPTS: {
  id: string;
  kwargs: Record<string, number>;
  typed: { quantity: string; price: string };
  coercedTo: { multibuy_quantity: number; multibuy_price_cents: number };
}[] = [
  {
    id: "n_float_but_integral_3_0",
    kwargs: {"multibuy_quantity": 3.0, "multibuy_price_cents": 65000},
    typed: { quantity: "3.0", price: "65000" },
    coercedTo: { multibuy_quantity: 3, multibuy_price_cents: 65000 },
  },
  {
    id: "p_float_but_integral",
    kwargs: {"multibuy_quantity": 3, "multibuy_price_cents": 65000.0},
    typed: { quantity: "3", price: "65000.0" },
    coercedTo: { multibuy_quantity: 3, multibuy_price_cents: 65000 },
  },
];

/**
 * Regression set for the OTHER rule kinds. `previewDiscount()` is a single
 * switch statement, so adding a branch to it is a change to shared code —
 * these pin percentage / fixed / free_shipping / bogo / tiered to the same
 * Python engine so a perturbation shows up as a failure, not a silent
 * mispriced offer in the merchant's preview pane.
 */
export interface OtherKindVector {
  id: string;
  rule: DiscountRule;
  lines: PreviewLine[];
  subtotalCents: number;
  pythonDiscountCents: number;
  pythonFreeShipping: boolean;
}

export const OTHER_KIND_PYTHON_VECTORS: OtherKindVector[] = [
  {
    id: "pct_10",
    rule: { kind: "percentage", value_percent: 10 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 2800,
    pythonFreeShipping: false,
  },
  {
    id: "pct_33_floor",
    rule: { kind: "percentage", value_percent: 33 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 9240,
    pythonFreeShipping: false,
  },
  {
    id: "pct_100",
    rule: { kind: "percentage", value_percent: 100 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 28000,
    pythonFreeShipping: false,
  },
  {
    id: "pct_0",
    rule: { kind: "percentage", value_percent: 0 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 0,
    pythonFreeShipping: false,
  },
  {
    id: "pct_50_capped",
    rule: { kind: "percentage", value_percent: 50, max_discount_cents: 5000 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 5000,
    pythonFreeShipping: false,
  },
  {
    id: "pct_10_min_subtotal_short",
    rule: { kind: "percentage", value_percent: 10, min_subtotal_cents: 99999 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 0,
    pythonFreeShipping: false,
  },
  {
    id: "fixed_5000",
    rule: { kind: "fixed", value_cents: 5000 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 5000,
    pythonFreeShipping: false,
  },
  {
    id: "fixed_over_subtotal",
    rule: { kind: "fixed", value_cents: 99999 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 28000,
    pythonFreeShipping: false,
  },
  {
    id: "fixed_0",
    rule: { kind: "fixed", value_cents: 0 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 0,
    pythonFreeShipping: false,
  },
  {
    id: "free_shipping",
    rule: { kind: "free_shipping" },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 0,
    pythonFreeShipping: true,
  },
  {
    id: "bogo_2_1_free",
    rule: { kind: "bogo", buy_quantity: 2, get_quantity: 1, get_discount_percent: 100 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 4000,
    pythonFreeShipping: false,
  },
  {
    id: "bogo_1_1_half",
    rule: { kind: "bogo", buy_quantity: 1, get_quantity: 1, get_discount_percent: 50 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 5000,
    pythonFreeShipping: false,
  },
  {
    id: "bogo_3_1_free",
    rule: { kind: "bogo", buy_quantity: 3, get_quantity: 1, get_discount_percent: 100 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 4000,
    pythonFreeShipping: false,
  },
  {
    id: "bogo_5_1_not_met",
    rule: { kind: "bogo", buy_quantity: 5, get_quantity: 1, get_discount_percent: 100 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 0,
    pythonFreeShipping: false,
  },
  {
    id: "bogo_2_1_zero_percent",
    rule: { kind: "bogo", buy_quantity: 2, get_quantity: 1, get_discount_percent: 0 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 0,
    pythonFreeShipping: false,
  },
  {
    id: "bogo_2_1_free_qty_lines",
    rule: { kind: "bogo", buy_quantity: 2, get_quantity: 1, get_discount_percent: 100 },
    lines: [{ unit_price_cents: 9000, quantity: 2 }, { unit_price_cents: 3000, quantity: 1 }, { unit_price_cents: 15000, quantity: 1 }],
    subtotalCents: 36000,
    pythonDiscountCents: 3000,
    pythonFreeShipping: false,
  },
  {
    id: "tiered_two_steps",
    rule: { kind: "tiered", tiers: [{ threshold_cents: 20000, percent: 10 }, { threshold_cents: 25000, percent: 20 }] },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 5600,
    pythonFreeShipping: false,
  },
  {
    id: "tiered_none_met",
    rule: { kind: "tiered", tiers: [{ threshold_cents: 50000, percent: 10 }] },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 0,
    pythonFreeShipping: false,
  },
  {
    id: "tiered_threshold_exact",
    rule: { kind: "tiered", tiers: [{ threshold_cents: 28000, percent: 15 }] },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 4200,
    pythonFreeShipping: false,
  },
  {
    id: "tiered_capped",
    rule: { kind: "tiered", tiers: [{ threshold_cents: 10000, percent: 50 }], max_discount_cents: 3000 },
    lines: [{ unit_price_cents: 10000, quantity: 1 }, { unit_price_cents: 8000, quantity: 1 }, { unit_price_cents: 6000, quantity: 1 }, { unit_price_cents: 4000, quantity: 1 }],
    subtotalCents: 28000,
    pythonDiscountCents: 3000,
    pythonFreeShipping: false,
  },
];
