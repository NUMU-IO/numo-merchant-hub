/**
 * diffPayloads — structural diff between two ThemeSettingsV3 payloads.
 *
 * Extracted from VersionDiffDialog so the pre-publish diff modal (and
 * any future diff surface, like CLI dry-runs) can reuse the same
 * implementation without re-importing the dialog. Pure functions; no
 * React. Safe to call from anywhere.
 */

import type { ThemeSettingsV3 } from "../../types";

export interface DiffEntry {
  /** Dotted path from the root of `ThemeSettingsV3` to the leaf. */
  path: string;
  kind: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
}

/** Pathological themes shouldn't lock the UI. Cap entries past 500. */
export const MAX_DIFF_ENTRIES = 500;

function isLeaf(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  const t = typeof v;
  if (t !== "object") return true;
  return false; // arrays + objects walked recursively
}

function diffValues(
  a: unknown,
  b: unknown,
  path: string,
  out: DiffEntry[],
): void {
  if (out.length >= MAX_DIFF_ENTRIES) return;
  if (isLeaf(a) && isLeaf(b)) {
    if (!Object.is(a, b)) {
      if (typeof a !== typeof b || JSON.stringify(a) !== JSON.stringify(b)) {
        out.push({ path, kind: "changed", before: a, after: b });
      }
    }
    return;
  }
  if (isLeaf(a) !== isLeaf(b)) {
    out.push({ path, kind: "changed", before: a, after: b });
    return;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      const ai = i < a.length ? a[i] : undefined;
      const bi = i < b.length ? b[i] : undefined;
      const childPath = `${path}[${i}]`;
      if (i >= a.length) {
        out.push({ path: childPath, kind: "added", after: bi });
      } else if (i >= b.length) {
        out.push({ path: childPath, kind: "removed", before: ai });
      } else {
        diffValues(ai, bi, childPath, out);
      }
    }
    return;
  }
  if (typeof a === "object" && typeof b === "object" && a && b) {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in aObj)) {
        out.push({ path: childPath, kind: "added", after: bObj[key] });
      } else if (!(key in bObj)) {
        out.push({ path: childPath, kind: "removed", before: aObj[key] });
      } else {
        diffValues(aObj[key], bObj[key], childPath, out);
      }
    }
  }
}

export function diffPayloads(
  a: ThemeSettingsV3,
  b: ThemeSettingsV3,
): DiffEntry[] {
  const out: DiffEntry[] = [];
  diffValues(a, b, "", out);
  return out;
}

/** Pretty-print a leaf value for display. */
export function formatLeaf(v: unknown): string {
  if (v === null) return "null";
  if (v === undefined) return "—";
  if (typeof v === "string")
    return v.length > 60 ? `"${v.slice(0, 60)}…"` : `"${v}"`;
  if (typeof v === "object") return JSON.stringify(v).slice(0, 80);
  return String(v);
}

/**
 * Group a flat list of diff entries into a more human-readable
 * "section-level" summary. Walks each entry's path and folds entries
 * under the same section into one summary line.
 *
 * E.g. given paths:
 *   templates.home.sections.hero.settings.headline   (changed)
 *   templates.home.sections.hero.settings.subtitle   (changed)
 *   templates.home.sections.marquee                  (added)
 *
 * Returns:
 *   [
 *     { sectionKey: "hero", changes: 2, kind: "changed" },
 *     { sectionKey: "marquee", kind: "added" },
 *   ]
 */
export interface SectionSummary {
  /** Friendly section identifier — the last meaningful segment of the path. */
  label: string;
  /** Root path the changes belong to. */
  rootPath: string;
  /** Number of leaf entries that rolled up into this section. */
  count: number;
  /** Top-line shape — when the whole section was added/removed, surface
   *  that as a single bold change instead of a list of "settings.foo added". */
  kind: "added" | "removed" | "changed";
}

export function summariseDiff(entries: DiffEntry[]): SectionSummary[] {
  const buckets = new Map<string, SectionSummary>();
  for (const entry of entries) {
    // The most useful grouping for merchants is by section/group/template.
    // Walk down to the first sections/<id> chunk in the path; everything
    // below it counts as "changes to section <id>".
    const match = entry.path.match(/^(.*?sections\.[^.[]+)/);
    const rootPath = match ? match[1] : entry.path.split(".").slice(0, 2).join(".");
    const label = rootPath.split(".").pop() ?? entry.path;
    const existing = buckets.get(rootPath);
    if (existing) {
      existing.count += 1;
      // If the section was wholesale-added or removed, that wins; mixed
      // changes stay "changed".
      if (existing.kind !== entry.kind) existing.kind = "changed";
    } else {
      buckets.set(rootPath, {
        label,
        rootPath,
        count: 1,
        kind: entry.kind,
      });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => b.count - a.count);
}
