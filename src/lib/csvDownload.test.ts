import { describe, expect, it } from "vitest";
import { buildCsv, fetchAllPages } from "./csvDownload";

describe("csv export", () => {
  it("starts with a BOM so Excel reads Arabic as UTF-8", () => {
    const csv = buildCsv(["name"], [["كتاب, جديد"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"كتاب, جديد"');
  });

  it("fetches every page, not just the first", async () => {
    const pages = [[1, 2], [3, 4], [5]];
    const asked: number[] = [];
    const all = await fetchAllPages(async (page) => {
      asked.push(page);
      return { items: pages[page - 1], total_pages: pages.length };
    });
    expect(all).toEqual([1, 2, 3, 4, 5]);
    expect(asked).toEqual([1, 2, 3]);
  });
});
