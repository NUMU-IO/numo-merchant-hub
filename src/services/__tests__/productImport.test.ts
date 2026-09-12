import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../api";
import { importProductRows } from "../productApi";

vi.mock("../api", () => ({ apiClient: vi.fn() }));

describe("product import variants", () => {
  beforeEach(() => vi.mocked(apiClient).mockReset().mockResolvedValue({ id: "product-1" }));

  it("creates one product with every row represented as a variant", async () => {
    const result = await importProductRows("store-1", [
      ["Product Handle *", "اسم المنتج *", "Option 1 Name", "Option 1 Value", "Option 2 Name", "Option 2 Value", "سعر الـ Variant *", "المخزون *", "SKU", "الحالة"],
      ["book", "Book", "Paper", "white", "Type", "paperback", "700 EGP", 5, "W-P", "نشط"],
      ["book", "Book", "Paper", "white", "Type", "hardcover", "850 EGP", 3, "W-H", "نشط"],
    ]);

    expect(result).toMatchObject({ created: 1, failed: 0 });
    expect(apiClient).toHaveBeenCalledTimes(1);
    const body = JSON.parse(vi.mocked(apiClient).mock.calls[0][1]?.body as string);
    expect(body.options).toEqual([
      { name: "Paper", position: 0, values: ["white"] },
      { name: "Type", position: 1, values: ["paperback", "hardcover"] },
    ]);
    expect(body.variants).toHaveLength(2);
    expect(body.quantity).toBe(8);
    expect(body.price).toBe("700.00");
  });
});
