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
  const csv = buildCsv(headers, rows);
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
