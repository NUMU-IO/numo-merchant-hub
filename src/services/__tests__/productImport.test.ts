import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../api";
import { importProductRows } from "../productApi";

vi.mock("../api", () => ({ apiClient: vi.fn() }));

describe("product import variants", () => {
  beforeEach(() => vi.mocked(apiClient).mockReset().mockResolvedValue({ id: "product-1" }));

  it("creates one product with every row represented as a variant", async () => {
    const result = await importProductRows("store-1", [
      ["Product Handle *", "اسم المنتج *", "name_ar", "description", "description_ar", "Option 1 Name", "option1_name_ar", "Option 1 Value", "option1_value_ar", "Option 2 Name", "Option 2 Value", "سعر الـ Variant *", "compare_at_price", "cost_price", "المخزون *", "SKU", "barcode", "weight", "الحالة", "images", "tags", "brand", "continue_selling_when_out_of_stock", "label_en", "label_ar", "seo_title", "robots_noindex", "metafield.custom.author"],
      ["book", "Book", "كتاب", "English copy", "وصف", "Paper", "الورق", "white", "أبيض", "Type", "paperback", "700 EGP", 800, 400, 5, "W-P", "111", 0.5, "نشط", "https://one.jpg|https://two.jpg", "books|fiction", "NUMU Press", "yes", "New", "جديد", "Book title", "true", "Author One"],
      ["book", "Book", "كتاب", "", "", "Paper", "الورق", "white", "أبيض", "Type", "hardcover", "850 EGP", 950, 500, 3, "W-H", "222", 0.8, "نشط", "", "", "", "", "", "", "", "", ""],
    ]);

    expect(result).toMatchObject({ created: 1, failed: 0 });
    expect(apiClient).toHaveBeenCalledTimes(2);
    const body = JSON.parse(vi.mocked(apiClient).mock.calls[0][1]?.body as string);
    expect(body.options).toEqual([
      { name: "Paper", position: 0, values: ["white"] },
      { name: "Type", position: 1, values: ["paperback", "hardcover"] },
    ]);
    expect(body.variants).toHaveLength(2);
    expect(body.quantity).toBe(8);
    expect(body.price).toBe("700.00");
    expect(body.cost_price).toBe("400");
    expect(body.images).toEqual(["https://one.jpg", "https://two.jpg"]);
    expect(body.tags).toEqual(["books", "fiction"]);
    expect(body.attributes).toMatchObject({
      nameAr: "كتاب",
      descriptionAr: "وصف",
      continue_selling_when_out_of_stock: true,
      label: { text_en: "New", text_ar: "جديد" },
      variant_meta: { axes: [{ name: "Paper", nameAr: "الورق", optionsAr: ["أبيض"] }, { name: "Type", nameAr: "", optionsAr: [] }] },
    });
    expect(body.variants[0]).toMatchObject({ compare_at_price: 800, cost_price: 400, barcode: "111", weight: 0.5 });
    expect(vi.mocked(apiClient).mock.calls[1][0]).toBe("/stores/store-1/metafields/owners/product/product-1");
  });
});
