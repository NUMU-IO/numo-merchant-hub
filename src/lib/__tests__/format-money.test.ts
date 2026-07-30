/**
 * `format-money` — the platform's single money boundary in the hub.
 *
 * Two rules this module exists to enforce, both merchant-visible:
 *
 *   1. No merchant-facing field or copy is denominated in minor units. Inputs
 *      hold MAJOR units ("650"); the API keeps taking minor units (65000).
 *   2. Currency is inherited from the active store, never hardcoded to EGP.
 *
 * `majorToMinor` / `minorToMajorInput` are the ONLY two places a promotion
 * form converts, so a defect in either is a 100x mispricing on a live offer —
 * the highest-severity failure this repo can ship from a form. That is why the
 * coverage below is boundary-heavy rather than example-heavy, and why the
 * round-trip is swept rather than spot-checked: a merchant who opens a saved
 * "EGP 650" bundle and presses Save without editing must send back 65000, not
 * 650 and not 6500000.
 *
 * Test design order: happy path → parsing validation → boundaries → errors →
 * round-trip invariants → currency inheritance.
 */

import { afterEach, describe, expect, it } from "vitest";

import {
  MINOR_UNITS_PER_MAJOR,
  currencyLabel,
  formatMoney,
  getActiveStoreCurrency,
  majorToMinor,
  minorToMajorInput,
  setActiveStoreCurrency,
} from "@/lib/format-money";

/** The new Saudi Riyal sign, U+20C1 — written as an escape so this file stays
 *  readable in editors without the webfont. */
const SAR_GLYPH = "⃁";

afterEach(() => {
  // The active currency is module-level state; leaving it set would silently
  // recolour every later assertion in this file.
  setActiveStoreCurrency("EGP");
});

// ─────────────────────────────────────────────────────────────────────────
// A. majorToMinor — what the merchant TYPES becomes what the API stores
// ─────────────────────────────────────────────────────────────────────────

describe("majorToMinor — happy path", () => {
  it("the platform's ratio is 100, stated once", () => {
    expect(MINOR_UNITS_PER_MAJOR).toBe(100);
  });

  it('"650" → 65000 (the flagship bundle price, x100 exactly)', () => {
    expect(majorToMinor("650")).toBe(650 * MINOR_UNITS_PER_MAJOR);
    expect(majorToMinor("650")).toBe(65000);
  });

  it("accepts a number as well as a string", () => {
    expect(majorToMinor(650)).toBe(65000);
    expect(majorToMinor(0.5)).toBe(50);
  });

  it.each([
    ["1", 100],
    ["500", 50000],
    ["1250", 125000],
    ["9999.99", 999999],
  ])("%s → %i", (typed, cents) => {
    expect(majorToMinor(typed)).toBe(cents);
  });
});

describe("majorToMinor — fractional major units are LEGITIMATE", () => {
  // The whole point of the major-unit switch: EGP 650.50 is a real price a
  // merchant can charge, and it is an integer number of piasters.
  it('"650.5" → 65050 and "650.50" → 65050', () => {
    expect(majorToMinor("650.5")).toBe(65050);
    expect(majorToMinor("650.50")).toBe(65050);
  });

  it('"0.01" → 1 — one piaster is representable', () => {
    expect(majorToMinor("0.01")).toBe(1);
  });

  it("ROUNDS, never truncates — truncating would silently UNDER-price", () => {
    // A merchant pasting a computed price with a third decimal must not lose
    // the piaster: 650.505 is nearer 650.51 than 650.50.
    expect(majorToMinor("650.505")).toBe(65051);
    expect(majorToMinor("650.504")).toBe(65050);
    expect(majorToMinor("6.505")).toBe(651);
    // Floor semantics would give 65050 / 650 here — pinned so a future
    // "let's just use Math.floor" is a visible decision, not a rounding tweak.
    expect(majorToMinor("650.505")).not.toBe(Math.floor(650.505 * 100));
  });

  it("every result is an integer number of minor units", () => {
    for (const typed of ["650.5", "650.505", "0.019", "1.005", "12.3456"]) {
      const cents = majorToMinor(typed)!;
      expect(Number.isInteger(cents), typed).toBe(true);
    }
  });
});

describe("majorToMinor — grouping separators a merchant may paste", () => {
  it("strips ASCII thousands commas", () => {
    expect(majorToMinor("1,250")).toBe(125000);
    expect(majorToMinor("1,250.50")).toBe(125050);
    expect(majorToMinor("1,000,000")).toBe(100000000);
  });

  it("strips surrounding and internal whitespace", () => {
    expect(majorToMinor(" 650 ")).toBe(65000);
    expect(majorToMinor("1 250")).toBe(125000);
  });

  it("strips the Arabic thousands mark (U+066C)", () => {
    expect(majorToMinor("1٬250")).toBe(125000);
  });

  it("Arabic-Indic DIGITS are refused rather than mis-parsed", () => {
    // Unreachable through the form (an `<input type="number">` value is always
    // ASCII), but pinned because the failure mode that matters is "returns a
    // WRONG number", and `null` is the safe answer: callers treat it as blank.
    expect(majorToMinor("١٢٥٠")).toBeNull();
  });
});

describe("majorToMinor — blank vs zero vs garbage", () => {
  it("blank input → null, so callers can omit the field", () => {
    // `Number("") === 0` destroys this distinction, which is why the helper
    // exists at all: an empty "cap discount at" box means UNCAPPED, not 0.
    expect(majorToMinor("")).toBeNull();
    expect(majorToMinor("   ")).toBeNull();
  });

  it("null / undefined → null", () => {
    expect(majorToMinor(null)).toBeNull();
    expect(majorToMinor(undefined)).toBeNull();
  });

  it('a typed "0" → 0, NOT null — the merchant said zero', () => {
    expect(majorToMinor("0")).toBe(0);
    expect(majorToMinor("0.00")).toBe(0);
    expect(majorToMinor(0)).toBe(0);
  });

  it.each(["abc", "6a5", "--5", "1.2.3", "EGP 650", "٦٥٠"])(
    "unparseable %s → null (never NaN, never a guess)",
    (typed) => {
      expect(majorToMinor(typed)).toBeNull();
    },
  );

  it("non-finite input → null", () => {
    expect(majorToMinor("Infinity")).toBeNull();
    expect(majorToMinor("1e400")).toBeNull();
    expect(majorToMinor(Number.NaN)).toBeNull();
  });

  it("BOUNDARY: an amount too small to be one minor unit rounds to 0", () => {
    // 0.4 piasters is not a price. It must land on 0 (which validators reject)
    // rather than on `null` (which reads as "left blank") or on 0.4.
    expect(majorToMinor("0.004")).toBe(0);
    expect(majorToMinor("0.0049")).toBe(0);
    // …and the half-piaster boundary rounds up, per the no-under-pricing rule.
    expect(majorToMinor("0.005")).toBe(1);
  });

  it("parsing is not validation: a negative amount parses", () => {
    // `majorToMinor` is a converter; rejecting negatives is the form's job
    // (and PromotionForm does). Pinned so nobody moves validation in here and
    // makes a negative look like a blank field.
    expect(majorToMinor("-5")).toBe(-500);
    expect(majorToMinor("-0.01")).toBe(-1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// B. minorToMajorInput — what the API stored becomes what the merchant SEES
// ─────────────────────────────────────────────────────────────────────────

describe("minorToMajorInput", () => {
  it("65000 → \"650\" — a whole amount hydrates without a decimal tail", () => {
    expect(minorToMajorInput(65000)).toBe("650");
  });

  it('65050 → "650.50" — the piasters survive the round trip', () => {
    expect(minorToMajorInput(65050)).toBe("650.50");
  });

  it.each([
    [1, "0.01"],
    [10, "0.10"],
    [100, "1"],
    [999999, "9999.99"],
    [125000, "1250"],
  ])("%i → %s", (cents, expected) => {
    expect(minorToMajorInput(cents)).toBe(expected);
  });

  it("0 → \"0\", but null / undefined → \"\" (an empty input)", () => {
    expect(minorToMajorInput(0)).toBe("0");
    expect(minorToMajorInput(null)).toBe("");
    expect(minorToMajorInput(undefined)).toBe("");
  });

  it("non-finite → \"\" rather than \"NaN\" in a number input", () => {
    expect(minorToMajorInput(Number.NaN)).toBe("");
    expect(minorToMajorInput(Number.POSITIVE_INFINITY)).toBe("");
  });

  it("negatives keep their sign", () => {
    expect(minorToMajorInput(-65000)).toBe("-650");
    expect(minorToMajorInput(-1)).toBe("-0.01");
  });

  it("emits NO currency symbol and NO grouping — `<input type=number>` rejects both", () => {
    // A grouped or symbol-bearing value silently blanks a number input, which
    // reads to the merchant as "my saved price disappeared".
    for (const cents of [1, 100, 65050, 125000, 100000000]) {
      expect(minorToMajorInput(cents), String(cents)).toMatch(
        /^-?\d+(\.\d{2})?$/,
      );
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// C. The invariant that prevents the 100x defect: round-trip stability
// ─────────────────────────────────────────────────────────────────────────

describe("round trip", () => {
  it("cents → input → cents is the identity across a wide sweep", () => {
    // This is the "merchant re-saves without editing" path. A single drifting
    // value here is a live offer repriced by 100x.
    const failures: string[] = [];
    const values = [0, 1, 5, 9, 10, 49, 50, 51, 99, 100, 101, 999];
    for (let c = 0; c <= 2000; c++) values.push(c);
    for (const c of [65000, 65050, 999999, 1000000, 123456789]) values.push(c);
    for (const cents of values) {
      const back = majorToMinor(minorToMajorInput(cents));
      if (back !== cents) failures.push(`${cents} → "${minorToMajorInput(cents)}" → ${back}`);
    }
    expect(failures.slice(0, 10)).toEqual([]);
    expect(failures).toHaveLength(0);
  });

  it("input → cents → input is stable for anything a merchant can type", () => {
    for (const typed of ["650", "650.5", "650.50", "0.01", "0", "1250"]) {
      const cents = majorToMinor(typed)!;
      const rendered = minorToMajorInput(cents);
      // Not necessarily byte-identical to what was typed ("650.5" renders as
      // "650.50"), but re-parsing must be a fixed point.
      expect(majorToMinor(rendered), typed).toBe(cents);
      expect(minorToMajorInput(majorToMinor(rendered)!), typed).toBe(rendered);
    }
  });

  it("neither direction is a x100 or ÷100 away from the other", () => {
    // Stated bluntly because this is the actual defect class: a stray extra
    // conversion at either boundary.
    for (const cents of [1, 100, 65000, 65050]) {
      const major = Number(minorToMajorInput(cents));
      expect(major).toBeCloseTo(cents / 100, 10);
      expect(majorToMinor(String(major))).toBe(cents);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// D. Currency inheritance — never a hardcoded EGP
// ─────────────────────────────────────────────────────────────────────────

describe("currencyLabel", () => {
  it("EGP reads as the ISO code in EN and as ج.م in AR", () => {
    expect(currencyLabel("EGP", "en")).toBe("EGP");
    expect(currencyLabel("EGP", "ar")).toBe("ج.م");
  });

  it("SAR reads as the riyal glyph (U+20C1) in BOTH locales", () => {
    expect(currencyLabel("SAR", "en")).toBe(SAR_GLYPH);
    expect(currencyLabel("SAR", "ar")).toBe(SAR_GLYPH);
    expect(currencyLabel("SAR", "en").codePointAt(0)).toBe(0x20c1);
  });

  it("an unmapped currency falls back to its ISO code in both locales", () => {
    expect(currencyLabel("AED", "en")).toBe("AED");
    expect(currencyLabel("AED", "ar")).toBe("AED");
  });

  it("is case-insensitive about the code it is handed", () => {
    expect(currencyLabel("egp", "en")).toBe("EGP");
    expect(currencyLabel("sar", "ar")).toBe(SAR_GLYPH);
  });

  it("defaults the locale to EN when omitted", () => {
    expect(currencyLabel("EGP")).toBe("EGP");
  });

  it("with no code, inherits the ACTIVE STORE currency", () => {
    // The inheritance rule: a label with no explicit code must still name the
    // signed-in store's currency, not a compiled-in default.
    expect(getActiveStoreCurrency()).toBe("EGP");
    expect(currencyLabel()).toBe("EGP");

    setActiveStoreCurrency("SAR");
    expect(currencyLabel()).toBe(SAR_GLYPH);
    expect(currencyLabel(undefined, "ar")).toBe(SAR_GLYPH);
    // The load-bearing assertion: no trace of the Egyptian default leaks into
    // a Saudi store's labels.
    expect(currencyLabel()).not.toContain("EGP");
    expect(currencyLabel(undefined, "ar")).not.toContain("ج.م");
  });

  it("a blank/whitespace store currency is ignored, not adopted", () => {
    setActiveStoreCurrency("");
    setActiveStoreCurrency("   ");
    setActiveStoreCurrency(null);
    expect(getActiveStoreCurrency()).toBe("EGP");
  });
});

describe("formatMoney — the rendering the pane and list depend on", () => {
  // Pinned literally in ONE place, so every other suite can build its
  // expectations from `formatMoney` without the format itself going unchecked.
  it("EN puts the currency FIRST, AR puts it last with Arabic-Indic digits", () => {
    expect(formatMoney(650, { locale: "en" })).toBe("EGP 650");
    expect(formatMoney(650, { locale: "ar" })).toBe("٦٥٠ ج.م");
  });

  it("groups thousands per market", () => {
    expect(formatMoney(1084, { locale: "en" })).toBe("EGP 1,084");
    expect(formatMoney(1084, { locale: "ar" })).toBe("١٬٠٨٤ ج.م");
  });

  it("fromCents divides by exactly 100", () => {
    expect(formatMoney(65000, { fromCents: true, locale: "en" })).toBe("EGP 650");
    expect(formatMoney(1, { fromCents: true, locale: "en" })).toBe("EGP 0.01");
  });

  it("keeps sub-unit amounts visible instead of rounding them to zero", () => {
    expect(formatMoney(0.03, { locale: "en" })).toBe("EGP 0.03");
    expect(formatMoney(216.66, { locale: "en" })).toBe("EGP 216.66");
  });

  it("a Saudi store renders SAR, with no EGP anywhere", () => {
    expect(formatMoney(650, { locale: "en", currency: "SAR" })).toBe(
      `${SAR_GLYPH} 650`,
    );
    expect(formatMoney(650, { locale: "ar", currency: "SAR" })).toBe(
      `٦٥٠ ${SAR_GLYPH}`,
    );
    for (const locale of ["en", "ar"] as const) {
      const out = formatMoney(650, { locale, currency: "SAR" });
      expect(out).not.toContain("EGP");
      expect(out).not.toContain("ج.م");
    }
  });

  it("an unmapped currency uses its ISO code", () => {
    expect(formatMoney(650, { locale: "en", currency: "AED" })).toBe("AED 650");
    // AR digits follow the market's CLDR data, not the language: ar-EG uses
    // Arabic-Indic numerals, ar-AE uses Latin ones. Pinned as observed rather
    // than assumed — the digits differ per currency, which is correct.
    expect(formatMoney(650, { locale: "ar", currency: "AED" })).toBe("650 AED");
    expect(formatMoney(650, { locale: "ar", currency: "EGP" })).toBe("٦٥٠ ج.م");
  });

  it("inherits the active store currency when none is passed", () => {
    setActiveStoreCurrency("SAR");
    expect(formatMoney(650, { locale: "en" })).toBe(`${SAR_GLYPH} 650`);
    expect(formatMoney(650, { locale: "en" })).not.toContain("EGP");
  });

  it("renders a bad amount as zero rather than \"NaN EGP\"", () => {
    expect(formatMoney(null, { locale: "en" })).toBe("EGP 0");
    expect(formatMoney(undefined, { locale: "en" })).toBe("EGP 0");
    expect(formatMoney(Number.NaN, { locale: "en" })).toBe("EGP 0");
  });
});
