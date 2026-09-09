import { describe, expect, it } from "vitest";

import { pickupMessage, toWhatsAppDigits, whatsAppLink } from "../whatsapp";

describe("toWhatsAppDigits", () => {
  it("accepts every way a merchant types an Egyptian number", () => {
    for (const input of [
      "01098433918",
      "+201098433918",
      "00201098433918",
      "201098433918",
      "010 9843 3918",
      "010-9843-3918",
      "+20 109 843 3918",
    ]) {
      expect(toWhatsAppDigits(input), input).toBe("201098433918");
    }
  });

  it("adds the country code when the leading zero was dropped", () => {
    expect(toWhatsAppDigits("1098433918")).toBe("201098433918");
  });

  it("leaves a foreign number's own country code alone", () => {
    expect(toWhatsAppDigits("+971501234567")).toBe("971501234567");
  });

  it("returns null rather than opening WhatsApp on nothing", () => {
    for (const input of [null, undefined, "", "   ", "—", "123"]) {
      expect(toWhatsAppDigits(input)).toBeNull();
    }
  });
});

describe("whatsAppLink", () => {
  it("encodes the message so newlines survive", () => {
    const url = whatsAppLink("01098433918", "hello\nthere & you");
    expect(url).toBe(
      "https://wa.me/201098433918?text=hello%0Athere%20%26%20you",
    );
  });

  it("is null when there is no usable phone", () => {
    expect(whatsAppLink("", "hi")).toBeNull();
  });
});

describe("pickupMessage", () => {
  const base = { courier: "كاثيدس", store: "Vionne", parcels: 3, isAr: true };

  it("says how many parcels and from where", () => {
    const msg = pickupMessage(base);
    // Arabic-Indic digits, per DESIGN.md and the rest of the Arabic UI.
    expect(msg).toContain("٣ شحنات");
    expect(msg).toContain("Vionne");
    expect(msg).toContain("كاثيدس");
  });

  it("mentions the cutoff only when the courier has one", () => {
    expect(pickupMessage({ ...base, cutoff: "16:00" })).toContain("16:00");
    expect(pickupMessage({ ...base, cutoff: null })).not.toContain("قبل");
  });

  it("never quotes a COD total — the hub's only figure is store-wide", () => {
    const msg = pickupMessage({ ...base, cutoff: "16:00" });
    expect(msg).not.toMatch(/EGP|جنيه|COD|تحصيل/);
  });

  it("pluralises English", () => {
    expect(pickupMessage({ ...base, parcels: 1, isAr: false })).toContain("1 parcel ");
    expect(pickupMessage({ ...base, parcels: 4, isAr: false })).toContain("4 parcels ");
  });

  it("agrees the Arabic noun with the count", () => {
    const ar = (parcels: number) => pickupMessage({ ...base, parcels });
    // One and two are carried by the noun itself — "١ شحنة" reads as broken.
    expect(ar(1)).toContain("عندنا شحنة للاستلام");
    expect(ar(2)).toContain("عندنا شحنتين للاستلام");
    expect(ar(3)).toContain("شحنات");
    expect(ar(15)).toContain("شحنة"); // 11-99 takes the singular form
  });

  it("writes Arabic copy, not a translated English sentence", () => {
    // Store and courier names are interpolated verbatim, so only the
    // template's own words are checked.
    const msg = pickupMessage({ ...base, store: "فيون", courier: "كاثيدس" });
    expect(msg).toMatch(/[؀-ۿ]/);
    expect(msg).not.toMatch(/[A-Za-z]/);
  });
});
