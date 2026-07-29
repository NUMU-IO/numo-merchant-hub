/**
 * Locale parity — every merchant-facing string ships in EN *and* masri AR.
 *
 * NUMU is Arabic-first for the Egyptian market, so a key that exists only in
 * `en.ts` renders as a raw dotted key (or silently falls back to English) in
 * the AR dashboard. This suite is the cheap, always-on guard for that; the
 * multibuy block at the bottom is the WS3-specific slice.
 *
 * It also pins the ENCODING of `ar.ts`. Rewriting that file through a shell
 * (`Set-Content` / `Out-File`) mojibakes every Arabic string and injects a
 * BOM — a mistake that has reached this repo before, and one that a normal
 * test suite never notices because the strings still "exist".
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { previewDiscount } from "@/lib/preview-discount";
import type { DiscountRule } from "@/services/promotionApi";

import ar from "../ar";
import en from "../en";

type Node = Record<string, unknown>;

function flatten(obj: Node, prefix = "", out: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flatten(value as Node, path, out);
    } else {
      out[path] = String(value);
    }
  }
  return out;
}

const EN = flatten(en as unknown as Node);
const AR = flatten(ar as unknown as Node);

/** i18next plural suffixes. Arabic has six forms, English two — extra AR
 *  keys of this shape are correct, not gaps. */
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

const placeholders = (value: string) =>
  [...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]).sort();

/**
 * Pre-existing placeholder mismatches, deliberately NOT fixed here (this is
 * a test change, not a copy change). Documented so the check below still
 * catches anything NEW.
 *  - emailTemplates.editor.subjectHint: AR translated the placeholder NAME
 *    itself ("{{متغير}}"), so it can never interpolate. Real (small) bug.
 *  - blog.articleCount_one: AR intentionally spells out "one article".
 */
const KNOWN_PLACEHOLDER_MISMATCHES = new Set([
  "emailTemplates.editor.subjectHint",
  "blog.articleCount_one",
]);

describe("locale parity (en ↔ ar)", () => {
  it("every English key has an Arabic translation", () => {
    const missing = Object.keys(EN).filter((k) => !(k in AR));
    expect(missing).toEqual([]);
  });

  it("every Arabic key has an English counterpart (plural forms aside)", () => {
    const orphans = Object.keys(AR).filter((k) => {
      if (k in EN) return false;
      const base = k.replace(PLURAL_SUFFIX, "");
      return !(base in EN) && !(`${base}_other` in EN) && !(`${base}_one` in EN);
    });
    expect(orphans).toEqual([]);
  });

  it("no blank strings in either locale", () => {
    expect(Object.entries(EN).filter(([, v]) => v.trim() === "")).toEqual([]);
    expect(Object.entries(AR).filter(([, v]) => v.trim() === "")).toEqual([]);
  });

  it("interpolation placeholders match between locales", () => {
    const mismatched = Object.keys(EN)
      .filter((k) => k in AR && !KNOWN_PLACEHOLDER_MISMATCHES.has(k))
      .filter(
        (k) =>
          JSON.stringify(placeholders(EN[k])) !==
          JSON.stringify(placeholders(AR[k])),
      );
    expect(mismatched).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// E. The multibuy strings specifically
// ─────────────────────────────────────────────────────────────────────────

const MULTIBUY_KEYS = [
  "promotions.list.discount_multibuy",
  "promotions.form.rule_kind.multibuy",
  "promotions.form.multibuy_quantity",
  "promotions.form.multibuy_price",
  "promotions.form.multibuy_help",
  "promotions.form.multibuy_targeting_title",
  "promotions.form.multibuy_eligible_set",
  "promotions.form.multibuy_eligible_help",
  // Added with the multi-select picker: the "Any product" tab's hint on the
  // multibuy side (BOGO's two sides have their own). Missing from ar.ts it
  // would fall back to English inside an otherwise-Arabic card.
  "promotions.form.multibuy_any_hint",
  "promotions.form.template.multibuy_3_for_650",
  "promotions.form.template.multibuy_2_for_500",
  "promotions.errors.multibuy_quantity_required",
  "promotions.errors.multibuy_price_required",
] as const;

const ARABIC_SCRIPT = /[\u0600-\u06ff]/;

describe("multibuy strings", () => {
  it.each(MULTIBUY_KEYS)("%s exists in both locales, non-empty", (key) => {
    expect(EN[key], `missing from en.ts: ${key}`).toBeTruthy();
    expect(AR[key], `missing from ar.ts: ${key}`).toBeTruthy();
    expect(EN[key].trim().length).toBeGreaterThan(0);
    expect(AR[key].trim().length).toBeGreaterThan(0);
  });

  it.each(MULTIBUY_KEYS)("%s is actually written in Arabic in ar.ts", (key) => {
    expect(ARABIC_SCRIPT.test(AR[key])).toBe(true);
    expect(AR[key]).not.toBe(EN[key]);
  });

  it("the list-column label interpolates quantity + price in both locales", () => {
    expect(placeholders(EN["promotions.list.discount_multibuy"])).toEqual([
      "price",
      "quantity",
    ]);
    expect(placeholders(AR["promotions.list.discount_multibuy"])).toEqual([
      "price",
      "quantity",
    ]);
  });

  it("the two validation errors are distinct in both locales", () => {
    expect(EN["promotions.errors.multibuy_quantity_required"]).not.toBe(
      EN["promotions.errors.multibuy_price_required"],
    );
    expect(AR["promotions.errors.multibuy_quantity_required"]).not.toBe(
      AR["promotions.errors.multibuy_price_required"],
    );
  });

  it("the template chip labels name the offer, not the mechanic", () => {
    // The chip is the merchant's entry point — "3 for EGP 650" must read as
    // the offer itself in both locales.
    expect(EN["promotions.form.template.multibuy_3_for_650"]).toContain("650");
    expect(AR["promotions.form.template.multibuy_3_for_650"]).toContain("650");
    expect(EN["promotions.form.template.multibuy_2_for_500"]).toContain("500");
    expect(AR["promotions.form.template.multibuy_2_for_500"]).toContain("500");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// The preview_explain block — a NESTED block, and the only i18n surface
// whose key set is chosen by code rather than by a template author
// ─────────────────────────────────────────────────────────────────────────

const EXPLAIN = "promotions.form.preview_explain";

/**
 * Every branch of `previewDiscount()`, driven for real so the key/param
 * pairs come from the engine instead of from a list someone remembered to
 * update. Cheap-cart (4 × ≤100 EGP) so the guard branches are reachable.
 */
const PREVIEW_CART = [
  { unit_price_cents: 10000, quantity: 1 },
  { unit_price_cents: 8000, quantity: 1 },
  { unit_price_cents: 6000, quantity: 1 },
  { unit_price_cents: 4000, quantity: 1 },
];

const BRANCH_RULES: DiscountRule[] = [
  { kind: "percentage", value_percent: 10, min_subtotal_cents: 999999 }, // below_minimum
  { kind: "free_shipping" },
  { kind: "percentage", value_percent: 10 },
  { kind: "fixed", value_cents: 5000 },
  { kind: "bogo", buy_quantity: 0, get_quantity: 1 }, // bogo_not_configured
  { kind: "bogo", buy_quantity: 5, get_quantity: 1 }, // bogo_not_met
  { kind: "bogo", buy_quantity: 2, get_quantity: 1 }, // bogo_applied
  { kind: "multibuy" }, // multibuy_not_configured
  { kind: "multibuy", multibuy_quantity: 9, multibuy_price_cents: 100 }, // multibuy_needs
  { kind: "multibuy", multibuy_quantity: 3, multibuy_price_cents: 65000 }, // multibuy_not_below
  { kind: "multibuy", multibuy_quantity: 2, multibuy_price_cents: 10000 }, // multibuy_applied
  { kind: "tiered", tiers: [{ threshold_cents: 999999, percent: 10 }] }, // tiered_none
  { kind: "tiered", tiers: [{ threshold_cents: 20000, percent: 10 }] }, // tiered_applied
  { kind: "quantity_break" as DiscountRule["kind"] }, // unknown
];

const BRANCHES = BRANCH_RULES.map((rule) => {
  const r = previewDiscount(rule, PREVIEW_CART);
  return {
    key: r.explanation_key,
    params: Object.keys(r.explanation_params ?? {}),
  };
});

describe("preview_explain (nested block)", () => {
  it("the parity walker actually RECURSES into it", () => {
    // Without this, a `flatten()` that stopped at the parent would make the
    // whole-file parity checks above silently vacuous for this block — the
    // exact failure mode that lets an untranslated nested block ship.
    const enKeys = Object.keys(EN).filter((k) => k.startsWith(`${EXPLAIN}.`));
    const arKeys = Object.keys(AR).filter((k) => k.startsWith(`${EXPLAIN}.`));
    expect(enKeys.length).toBeGreaterThan(10);
    expect(enKeys.sort()).toEqual(arKeys.sort());
    // The parent itself must NOT appear as a leaf (that would mean the
    // walker stringified the object, i.e. "[object Object]").
    expect(EN[EXPLAIN]).toBeUndefined();
    expect(AR[EXPLAIN]).toBeUndefined();
  });

  it("every key the ENGINE can emit exists in both locales", () => {
    const missingEn = BRANCHES.filter((b) => !(`${EXPLAIN}.${b.key}` in EN));
    const missingAr = BRANCHES.filter((b) => !(`${EXPLAIN}.${b.key}` in AR));
    expect(missingEn.map((b) => b.key)).toEqual([]);
    expect(missingAr.map((b) => b.key)).toEqual([]);
  });

  it("the block carries no DEAD keys the engine never emits", () => {
    // A stale key is harmless at runtime but rots: the next person assumes
    // it is reachable and translates around it.
    const emitted = new Set(BRANCHES.map((b) => b.key));
    const declared = Object.keys(EN)
      .filter((k) => k.startsWith(`${EXPLAIN}.`))
      .map((k) => k.slice(EXPLAIN.length + 1));
    expect(declared.filter((k) => !emitted.has(k))).toEqual([]);
    expect(declared.length).toBe(emitted.size);
  });

  it("every entry is genuinely Arabic in ar.ts, not an English copy", () => {
    for (const key of Object.keys(AR).filter((k) =>
      k.startsWith(`${EXPLAIN}.`),
    )) {
      expect(ARABIC_SCRIPT.test(AR[key]), `not Arabic: ${key}`).toBe(true);
      expect(AR[key], `identical to EN: ${key}`).not.toBe(EN[key]);
    }
  });

  it("placeholder NAMES match between locales, per key", () => {
    // Covered generically above too, but pinned here because these
    // placeholders are supplied by code: a renamed one fails silently,
    // rendering the literal "{{breakEven}}" to the merchant.
    for (const key of Object.keys(EN).filter((k) =>
      k.startsWith(`${EXPLAIN}.`),
    )) {
      expect(placeholders(AR[key]), key).toEqual(placeholders(EN[key]));
    }
  });

  it("every placeholder used is one the engine actually supplies", () => {
    const unsupplied: string[] = [];
    for (const { key, params } of BRANCHES) {
      for (const locale of [EN, AR]) {
        for (const ph of placeholders(locale[`${EXPLAIN}.${key}`])) {
          if (!params.includes(ph)) unsupplied.push(`${key} → {{${ph}}}`);
        }
      }
    }
    expect(unsupplied).toEqual([]);
  });

  it("the union of placeholders is the documented set", () => {
    // Regression anchor for WS3: these are the interpolations the preview
    // contract promises. A new one appearing here without both locales
    // updated is caught by the per-key check above; this pins the roster.
    const used = new Set<string>();
    for (const key of Object.keys(EN).filter((k) =>
      k.startsWith(`${EXPLAIN}.`),
    )) {
      for (const ph of placeholders(EN[key])) used.add(ph);
    }
    expect([...used].sort()).toEqual([
      "breakEven",
      "bundles",
      "buy",
      "cents",
      "get",
      "groups",
      "have",
      "percent",
      "quantity",
    ]);
  });
});

describe("preview pane copy outside the nested block", () => {
  it("preview_break_even interpolates {{price}} in both locales", () => {
    expect(placeholders(EN["promotions.form.preview_break_even"])).toEqual([
      "price",
    ]);
    expect(placeholders(AR["promotions.form.preview_break_even"])).toEqual([
      "price",
    ]);
    expect(ARABIC_SCRIPT.test(AR["promotions.form.preview_break_even"])).toBe(
      true,
    );
  });

  it("preview_sample_label interpolates {{count}} — it no longer hardcodes 4", () => {
    // The derived multibuy cart is N+1 items, so a hardcoded "4-item" label
    // lied for every N except 3.
    for (const locale of [EN, AR]) {
      expect(
        placeholders(locale["promotions.form.preview_sample_label"]),
      ).toEqual(["count"]);
      expect(locale["promotions.form.preview_sample_label"]).not.toMatch(/\b4\b/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Encoding integrity of ar.ts
// ─────────────────────────────────────────────────────────────────────────

describe("ar.ts encoding", () => {
  // NOTE: deliberately NOT `new URL("../ar.ts", import.meta.url)` — Vite
  // rewrites that exact pattern into an asset URL (it resolves to
  // http://localhost:3000/... under vitest), so `fileURLToPath` throws
  // "The URL must be of scheme file" at collection time.
  const here = dirname(fileURLToPath(import.meta.url));
  const arPath = join(here, "..", "ar.ts");
  const enPath = join(here, "..", "en.ts");
  const arBytes = readFileSync(arPath);
  const arText = arBytes.toString("utf8");

  it("keeps its pre-existing UTF-8 BOM (and en.ts keeps none)", () => {
    expect([...arBytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect([...readFileSync(enPath).subarray(0, 3)]).not.toEqual([
      0xef, 0xbb, 0xbf,
    ]);
  });

  it("contains no U+FFFD replacement characters", () => {
    expect(arText.includes("\ufffd")).toBe(false);
  });

  it("contains no CP1252-style mojibake sequences", () => {
    // UTF-8 Arabic misread as Latin-1/CP1252 always produces
    // U+00D8/D9/DA/DB or U+00C3 immediately followed by another
    // high-Latin character. Written with \u escapes, never literals:
    // this file must stay pure ASCII so it can't itself become a
    // casualty of the corruption it exists to detect.
    const mojibake = arText.match(
      /[\u00c3\u00d8\u00d9\u00da\u00db\u00e2][\u0080-\u00bf\u2000-\u206f]/g,
    );
    expect(mojibake ?? []).toEqual([]);
  });

  it("still contains real Arabic script", () => {
    expect(ARABIC_SCRIPT.test(arText)).toBe(true);
  });
});
