/**
 * Phase 0 PWA build guards. Run AFTER `npm run build`.
 *
 * These exist because both failure modes are SILENT:
 *
 *   1. Precache bloat. A broad `globPatterns` silently precaches all ~343 route
 *      chunks (measured 2026-08-08: 346 entries / 4,924 KiB) instead of the
 *      ~1.1 MB shell. Nothing errors — merchants just pay a multi-megabyte
 *      install on Egyptian mobile data. A regression here looks like nothing.
 *
 *   2. A cache rule that matches /api/. That is a cross-tenant data leak (the
 *      Cache API keys by URL and ignores the X-Tenant-Id header), and it would
 *      pass every functional test.
 *
 * Both FAIL the build. Neither warns.
 *
 * Usage:  node scripts/check-precache.mjs
 */
import { readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const swPath = join(dist, "sw.js");

/** Shell-only budget. The measured shell is ~1.22 MB; this leaves headroom for
 *  growth while still catching a "precache everything" regression (which would
 *  be ~4.9 MB). Overridable so the guard's own failure path can be exercised:
 *      PRECACHE_BUDGET_KIB=100 node scripts/check-precache.mjs   # must FAIL */
const BUDGET_BYTES = process.env.PRECACHE_BUDGET_KIB
  ? Number(process.env.PRECACHE_BUDGET_KIB) * 1024
  : 2.5 * 1024 * 1024;

/** Never precache these — see vite.config.ts globIgnores for the sizes. */
const FORBIDDEN = [
  { re: /\.worker-[^/]*\.js$/, why: "Monaco language worker (~11.1 MB total)" },
  { re: /ThemeCodeEditor-/, why: "Monaco editor bundle (3.3 MB)" },
  { re: /marketplace-thumbs\//, why: "marketplace thumbnails (3.2 MB)" },
  { re: /vendor-sentry-/, why: "Sentry (259 KB, not needed for first paint)" },
  { re: /vendor-charts-/, why: "Recharts (433 KB, runtime-cached instead)" },
];

const fail = (msg) => {
  console.error(`\n  FAIL  ${msg}\n`);
  process.exitCode = 1;
};

if (!existsSync(swPath)) {
  // Distinguish "PWA deliberately disabled" from "the build is broken" WITHOUT
  // reading VITE_PWA_ENABLED: the guard usually runs as a separate CI step from
  // the build, so it would not see a per-command env var and would fail a
  // perfectly good disabled build.
  //
  // Signature of a deliberate disable: the plugin injected nothing at all — no
  // worker AND no manifest AND no manifest <link> in the HTML. A build where
  // the plugin was ENABLED but failed does not reach this point; vite-plugin-pwa
  // errors out rather than silently emitting nothing.
  const html = join(dist, "index.html");
  const disabled =
    !existsSync(join(dist, "manifest.webmanifest")) &&
    existsSync(html) &&
    !/rel="manifest"\s+href=/.test(readFileSync(html, "utf8"));

  if (disabled) {
    console.log("PWA disabled for this build (no worker, manifest or manifest link) — guards skipped.");
    process.exit(0);
  }
  fail(
    "dist/sw.js not found, but the build looks PWA-enabled (a manifest or manifest link is present).\n" +
      "        Either the build did not run, or vite-plugin-pwa failed to emit the worker.",
  );
  process.exit(1);
}

const sw = readFileSync(swPath, "utf8");

// ─── Guard 1: /api/ must be NetworkOnly, and nothing may cache it ────────────
// dist/sw.js is MINIFIED, so Workbox's `NetworkOnly` class name is mangled and
// cannot be asserted there. We therefore check two complementary things:
//   • the SOURCE still registers NetworkOnly for /api/ (meaningful, readable)
//   • the BUILT worker still contains the "/api/" literal (proves the rule
//     survived bundling and was not tree-shaken away)
const swSource = readFileSync(join(root, "src", "sw.ts"), "utf8");
if (!/new\s+NetworkOnly\s*\(/.test(swSource)) {
  fail("src/sw.ts no longer registers a NetworkOnly strategy — the /api/ deny rule is gone.");
}
if (!/startsWith\(["']\/api\/["']\)/.test(swSource)) {
  fail("src/sw.ts no longer matches paths starting with /api/ — the deny rule was renamed or dropped.");
}
if (!/\/api\//.test(sw)) {
  fail("dist/sw.js contains no '/api/' literal — the deny rule did not survive the build.");
}

// ─── Guard 2: precache manifest ─────────────────────────────────────────────
// injectManifest emits JSON-style quoted keys: {"revision":"…","url":"…"}.
// Accept an unquoted key too, in case a future plugin version minifies it.
const urls = [...sw.matchAll(/"url"\s*:\s*"([^"]+)"|[{,]\s*url\s*:\s*"([^"]+)"/g)].map(
  (m) => m[1] ?? m[2],
);
if (urls.length === 0) {
  fail("Could not parse a precache manifest out of dist/sw.js.");
  process.exit(1);
}

let total = 0;
const missing = [];
const rows = [];
for (const url of urls) {
  const clean = url.split("?")[0].replace(/^\//, "");
  const p = join(dist, clean);
  if (!existsSync(p)) {
    missing.push(url);
    continue;
  }
  const size = statSync(p).size;
  total += size;
  rows.push({ url: clean, size });
}

const offenders = [];
for (const { url } of rows) {
  for (const f of FORBIDDEN) {
    if (f.re.test(url)) offenders.push(`${url}  — ${f.why}`);
  }
}

// ─── Report ─────────────────────────────────────────────────────────────────
const kib = (b) => `${(b / 1024).toFixed(1)} KiB`;
console.log(`\nPrecache: ${rows.length} entries, ${kib(total)} (budget ${kib(BUDGET_BYTES)})`);
for (const r of [...rows].sort((a, b) => b.size - a.size).slice(0, 8)) {
  console.log(`   ${kib(r.size).padStart(11)}  ${r.url}`);
}

if (missing.length) {
  fail(`${missing.length} precached entr${missing.length === 1 ? "y" : "ies"} not found in dist/: ${missing.slice(0, 5).join(", ")}`);
}
if (offenders.length) {
  fail(`Forbidden entries in the precache manifest:\n        ${offenders.join("\n        ")}`);
}
if (total > BUDGET_BYTES) {
  fail(
    `Precache is ${kib(total)}, over the ${kib(BUDGET_BYTES)} budget by ${kib(total - BUDGET_BYTES)}.\n` +
      `        Fix the globPatterns allowlist in vite.config.ts — do NOT raise this budget\n` +
      `        without a deliberate decision. Merchants pay this on install, over mobile data.`,
  );
}

// ─── Guard 3: the Mobile Lite Editor must stay free of Monaco ───────────────
// Phase 1B. The mobile theme editor is reachable on phones; Monaco is ~11.1 MB
// and desktop-only. The route split reads `matchMedia` synchronously so only
// one branch ever mounts — but a stray import (especially of the feature's
// barrel, which re-exports the desktop page) would silently undo that. Assert
// on BUILD OUTPUT, because that is what a transitive import actually produces.
const assets = join(dist, "assets");
if (existsSync(assets)) {
  const files = readdirSync(assets);
  const mobileChunks = files.filter(
    (f) => /^(MobileLiteEditor|ThemeEditorViewportSwitch)-/.test(f) && f.endsWith(".js"),
  );

  if (mobileChunks.length === 0) {
    console.log("  note  no Mobile Lite Editor chunk in this build — skipping guard 3.");
  } else {
    const before = process.exitCode;

    for (const chunk of mobileChunks) {
      const src = readFileSync(join(assets, chunk), "utf8");

      // Monaco must not appear in EITHER chunk.
      if (/monaco/i.test(src)) {
        fail(`${chunk} references Monaco. The mobile theme editor must never load it (~11.1 MB).`);
      }

      // The desktop-chunk check applies ONLY to MobileLiteEditor.
      // ThemeEditorViewportSwitch legitimately contains BOTH chunk URLs — it is
      // the thing that chooses between them, and a `lazy()` reference is just a
      // URL until the branch actually executes. Failing it here would be
      // flagging correct code splitting as a defect.
      if (
        /^MobileLiteEditor-/.test(chunk) &&
        /ThemeCustomizerV3-[A-Za-z0-9_-]+\.js/.test(src)
      ) {
        fail(
          `${chunk} pulls in the DESKTOP customizer chunk.\n` +
            `        Phones would fetch it. Check for an import of\n` +
            `        "@/features/theme-editor-v3" — that barrel re-exports the desktop page.`,
        );
      }
    }

    if (process.exitCode === before) {
      console.log(
        `  OK  ${mobileChunks.length} mobile-editor chunk(s): no Monaco; MobileLiteEditor does not pull the desktop customizer.`,
      );
    }
  }
}

if (!process.exitCode) console.log("\n  OK  precache within budget, no forbidden entries, /api/ deny rule present.\n");
