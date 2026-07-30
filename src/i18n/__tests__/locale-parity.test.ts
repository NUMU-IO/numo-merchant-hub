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

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RuleTemplateRow } from "@/components/marketing/RuleTemplateRow";
import { formatMoney } from "@/lib/format-money";
import { previewDiscount } from "@/lib/preview-discount";
import type { DiscountRule } from "@/services/promotionApi";

import i18n from "..";
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

  it("the template chip labels name the offer via a {{price}} placeholder", () => {
    // The chip is the merchant's entry point — it must read as the offer
    // itself ("3 for EGP 650"), not as the mechanic ("bundle price rule").
    //
    // The money is no longer a literal in the copy: it can't be, or a Saudi
    // store's chip would advertise Egyptian pounds. `RuleTemplateRow` supplies
    // it from the template's own value, formatted in the store's currency —
    // so what the string must guarantee is the PLACEHOLDER, in both locales,
    // and that no currency is baked in. The rendered chip is asserted below,
    // because a placeholder nobody fills renders as "3 for {{price}}".
    for (const key of [
      "promotions.form.template.multibuy_3_for_650",
      "promotions.form.template.multibuy_2_for_500",
    ]) {
      expect(placeholders(EN[key]), key).toEqual(["price"]);
      expect(placeholders(AR[key]), key).toEqual(["price"]);
      for (const locale of [EN, AR]) {
        expect(locale[key], key).not.toMatch(/EGP|ج\.م/);
      }
    }
    // The tiered chips name a threshold the same way.
    for (const key of [
      "promotions.form.template.spend_1000_off_10",
      "promotions.form.template.spend_2000_off_20",
    ]) {
      expect(placeholders(EN[key]), key).toEqual(["threshold"]);
      expect(placeholders(AR[key]), key).toEqual(["threshold"]);
      for (const locale of [EN, AR]) {
        expect(locale[key], key).not.toMatch(/EGP|ج\.م/);
      }
    }
  });

  it.each(["en", "ar"] as const)(
    "the RENDERED chip shows the money in %s, with no unfilled placeholder",
    async (lang) => {
      // The honest replacement for the old literal-"650" check: drive the real
      // component and read what a merchant would see. This is what proves the
      // placeholder is actually supplied — and, because `formatMoney` reads the
      // active store currency, that the chip inherits it rather than hardcoding.
      await i18n.changeLanguage(lang);
      const strings = (lang === "ar" ? ar : en).promotions.form.template;
      const money = (major: number) => formatMoney(major, { locale: lang });

      render(createElement(RuleTemplateRow, { onApply: () => {} }));

      const trio = screen.getByTestId("rule-template-multibuy_3_for_650");
      expect(trio.textContent).toBe(
        strings.multibuy_3_for_650.replace("{{price}}", money(650)),
      );
      // The number itself is on screen, in that locale's digits.
      expect(trio.textContent).toContain(money(650));

      const duo = screen.getByTestId("rule-template-multibuy_2_for_500");
      expect(duo.textContent).toBe(
        strings.multibuy_2_for_500.replace("{{price}}", money(500)),
      );

      const spend = screen.getByTestId("rule-template-spend_1000_off_10");
      expect(spend.textContent).toBe(
        strings.spend_1000_off_10.replace("{{threshold}}", money(1000)),
      );

      // No chip may leak a raw placeholder or a raw minor-unit figure.
      for (const chip of screen.getAllByTestId(/^rule-template-/)) {
        expect(chip.textContent, chip.dataset.testid).not.toMatch(/\{\{|\}\}/);
        expect(chip.textContent, chip.dataset.testid).not.toContain("65000");
        expect(chip.textContent, chip.dataset.testid).not.toContain("50000");
      }

      await i18n.changeLanguage("en");
    },
  );
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

/**
 * The render layer's money mapping, mirrored from `PromotionRulePreview`.
 *
 * `previewDiscount` names money params `*_cents` (integer minor units); the
 * component formats each one in the store's currency and re-keys it to the
 * name the copy interpolates. So a placeholder is "supplied" if the engine
 * emits it directly OR emits its `_cents` source.
 *
 * The `_cents` suffix is the contract, and this map is the other half of it:
 * a NEW money param added to the engine without an entry here would print raw
 * minor units to the merchant — a 100x figure on screen.
 */
const CENTS_ALIASES: Record<string, string> = {
  amount_cents: "amount",
  break_even_cents: "breakEven",
};

const suppliedNames = (params: string[]) =>
  params.map((p) => CENTS_ALIASES[p] ?? p);

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
      const supplied = suppliedNames(params);
      for (const locale of [EN, AR]) {
        for (const ph of placeholders(locale[`${EXPLAIN}.${key}`])) {
          if (!supplied.includes(ph)) unsupplied.push(`${key} → {{${ph}}}`);
        }
      }
    }
    expect(unsupplied).toEqual([]);
  });

  it("every money param the engine emits has a formatting alias", () => {
    // The other direction of the same contract. A `*_cents` param with no
    // alias is not a missing translation — it is a raw minor-unit number
    // rendered to a merchant, i.e. a 100x price on screen.
    const unaliased = new Set<string>();
    for (const { params } of BRANCHES) {
      for (const p of params) {
        if (p.endsWith("_cents") && !(p in CENTS_ALIASES)) unaliased.add(p);
      }
    }
    expect([...unaliased]).toEqual([]);
    // And the map is live, not vestigial: at least one branch uses each alias.
    const emitted = new Set(BRANCHES.flatMap((b) => b.params));
    for (const source of Object.keys(CENTS_ALIASES)) {
      expect(emitted.has(source), `${source} unreachable`).toBe(true);
    }
  });

  it("no copy in the block names a currency or a minor unit itself", () => {
    // The platform rule, executed on the strings: currency is inherited from
    // the store at render time, so it cannot appear in the source copy — and
    // no merchant-facing sentence may be denominated in piasters/cents.
    for (const key of Object.keys(EN).filter((k) => k.startsWith(`${EXPLAIN}.`))) {
      expect(EN[key], key).not.toMatch(/\bEGP\b|\bcents?\b/i);
      expect(AR[key], key).not.toMatch(/ج\.م|قرش|قروش/);
    }
    for (const key of [
      "promotions.form.preview_break_even",
      "promotions.form.multibuy_price",
      "promotions.form.min_subtotal",
      "promotions.form.max_discount",
      "promotions.form.tier_threshold",
      "promotions.form.fixed_label",
      "promotions.list.discount_fixed",
      "promotions.list.discount_multibuy",
      "promotions.errors.multibuy_price_required",
    ]) {
      expect(EN[key], key).not.toMatch(/\bEGP\b|\bcents?\b/i);
      expect(AR[key], key).not.toMatch(/ج\.م|قرش|قروش/);
    }
  });

  it("the union of placeholders is the documented set", () => {
    // Regression anchor for WS3: these are the interpolations the preview
    // contract promises. A new one appearing here without both locales
    // updated is caught by the per-key check above; this pins the roster.
    //
    // `cents` is gone by design: every money interpolation is now a formatted
    // amount in the store's currency (`amount` / `breakEven`), never a raw
    // minor-unit figure the copy has to label "cents".
    const used = new Set<string>();
    for (const key of Object.keys(EN).filter((k) =>
      k.startsWith(`${EXPLAIN}.`),
    )) {
      for (const ph of placeholders(EN[key])) used.add(ph);
    }
    expect([...used].sort()).toEqual([
      "amount",
      "breakEven",
      "bundles",
      "buy",
      "get",
      "groups",
      "have",
      "percent",
      "quantity",
    ]);
    expect(used.has("cents")).toBe(false);
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
