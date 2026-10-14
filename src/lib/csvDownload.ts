/**
 * Tiny client-side CSV builder + browser download helper.
 *
 * Pages assemble their own (headers, rows) from the React Query data
 * they already have, then call `downloadCsv(...)`. No backend changes,
 * no extra round-trip, and the export always reflects exactly what
 * the user is looking at.
 */

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Wrap in quotes if it contains delimiter, quote, or newline; double
  // any embedded quotes to escape them.
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCell).join(",");
  const bodyLines = rows.map((r) => r.map(escapeCell).join(","));
  // Prepend a UTF-8 BOM so Excel renders Arabic correctly.
  return "﻿" + [headerLine, ...bodyLines].join("\r\n");
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  saveCsv(filename, buildCsv(headers, rows));
}

/** Download an already-built CSV string (from `buildCsv`, so it carries the BOM). */
export function saveCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke — Safari needs the URL to remain valid for the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Every page of a paginated list, for exports. A page on screen is 20 rows;
 * an export of "my orders" means all of them, under the same filters.
 */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ items: T[]; total_pages: number }>,
  maxPages = 200,
): Promise<T[]> {
  const first = await fetchPage(1);
  const items = [...first.items];
  for (let page = 2; page <= Math.min(first.total_pages, maxPages); page++) {
    items.push(...(await fetchPage(page)).items);
  }
  return items;
}
