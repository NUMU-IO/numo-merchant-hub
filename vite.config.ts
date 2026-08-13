import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

/**
 * PWA kill switch. `VITE_PWA_ENABLED=false` builds with no service worker and
 * no manifest — main.tsx also skips registration, so the app behaves exactly
 * as it did before Phase 0.
 *
 * NOTE: this stops NEW registrations. It does not unregister a worker already
 * installed on a merchant's device — for that, deploy scripts/sw-kill.js as
 * /sw.js (see that file's header for the incident procedure).
 */
const PWA_ENABLED = process.env.VITE_PWA_ENABLED !== "false";

/**
 * Injects Content-Security-Policy meta tag only in production builds.
 * In dev mode, Vite's HMR requires inline scripts and cross-port API calls which CSP would block.
 */
/**
 * Remove modulepreload hints for chunks that aren't needed on first paint.
 * They still load on-demand — we just don't eagerly prefetch them.
 */
function viteStripHeavyPreloads(): Plugin {
  const heavy = ["vendor-charts", "vendor-sentry"];
  return {
    name: "numu-strip-heavy-preloads",
    enforce: "post",
    transformIndexHtml(html) {
      return html.replace(
        /\s*<link rel="modulepreload"[^>]*?(?:vendor-charts|vendor-sentry)[^>]*>\s*/g,
        "\n",
      );
    },
  };
}

function vitePluginCSP(): Plugin {
  return {
    name: "numu-csp",
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html; // skip in dev
      return {
        html,
        tags: [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content:
                [
                  "default-src 'self'",
                  // connect.facebook.net hosts the JS SDK loaded by the
                  // Meta Embedded Signup flow on /whatsapp (BYO connect).
                  // The SDK injects inline scripts as part of its boot.
                  //
                  // `script-src-elem` controls dynamically-injected
                  // <script src> elements; `script-src-attr` controls
                  // inline event handlers. Some Chromium builds don't
                  // cleanly fall back from script-src to script-src-elem
                  // for runtime-injected scripts, so we set both.
                  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://connect.facebook.net",
                  "script-src-elem 'self' 'unsafe-inline' https://accounts.google.com https://apis.google.com https://connect.facebook.net",
                  "script-src-attr 'self' 'unsafe-inline'",
                  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
                  "font-src 'self' https://fonts.gstatic.com",
                  "img-src 'self' data: blob: https:",
                  // graph.facebook.com is hit by the SDK when exchanging
                  // the embedded-signup token; backend mirrors live on
                  // numueg.app so we keep that too.
                  "connect-src 'self' https://numueg.app https://*.numueg.app https://accounts.google.com https://*.sentry.io https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://graph.facebook.com https://*.facebook.com",
                  // www.facebook.com is the Embedded Signup dialog iframe.
                  "frame-src 'self' https://numueg.app https://*.numueg.app https://accounts.google.com https://www.facebook.com https://*.facebook.com",
                  "worker-src 'self' blob:",
                ].join("; ") + ";",
            },
            injectTo: "head",
          },
        ],
      };
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        // Local FastAPI on :8021. Point at https://numueg.app to hit
        // staging/prod instead.
        target: "http://127.0.0.1:8021",
        changeOrigin: true,
        cookieDomainRewrite: "",
        secure: false,
      },
    },
  },
  // `vite preview` serves the PRODUCTION build, which is the only way to
  // exercise the service worker (it does not register in dev). But preview does
  // NOT inherit `server.proxy`, so without this block every /api call 404s and
  // the SW can never be tested against a real session — which is exactly what
  // the ship-blocking cache tests need.
  //
  // Override the backend with NUMU_PREVIEW_API (e.g. http://127.0.0.1:8021).
  // NEVER point this at production.
  preview: {
    port: 4173,
    proxy: {
      "/api": {
        target: process.env.NUMU_PREVIEW_API || "http://127.0.0.1:8001",
        changeOrigin: true,
        cookieDomainRewrite: "",
        secure: false,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      // Response headers for the two files this plugin emits live in
      // vercel.json (JSON, so they cannot carry their own comments):
      //   /sw.js  -> Cache-Control: public, max-age=0, must-revalidate
      //              (a cached worker cannot be replaced on installed clients;
      //              Vercel's static default already matches, stated explicitly
      //              so a future default change cannot pin the fleet to an old
      //              worker) + Service-Worker-Allowed: / so it claims the origin.
      //   /manifest.webmanifest -> Content-Type: application/manifest+json,
      //              because some hosts guess text/plain for .webmanifest and
      //              Chrome then ignores it and silently blocks installability.
      //
      // injectManifest (not generateSW): we hand-write src/sw.ts because the
      // worker needs an explicit NetworkOnly deny on /api/, cache purging on
      // logout, and (Phase 2) push handlers. generateSW can host none of that.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",

      // "prompt", NEVER "autoUpdate". The hub is code-split into ~343 chunks
      // and lazy-loads every page. A silent skipWaiting drops the old precache
      // mid-session, so a merchant editing a product gets
      // "Failed to fetch dynamically imported module" and loses their work.
      // With "prompt" the new worker waits, the old one keeps serving the old
      // chunks, and the merchant chooses when to reload.
      registerType: "prompt",

      // We register manually in main.tsx AFTER React mounts, so service-worker
      // fetch never competes with first paint.
      injectRegister: null,

      disable: !PWA_ENABLED,

      injectManifest: {
        // ALLOWLIST the shell — do NOT use a broad "**/*.{js,css,html}" glob.
        // Measured 2026-08-08: the broad glob precached all 343 route chunks =
        // 346 entries / 4,924 KiB. On Egyptian mobile data that is an
        // indefensible install cost for an app most of whose routes a given
        // merchant never opens.
        //
        // This list is the shell only (~1.1 MB). The ~330 route chunks are
        // runtime-cached on first visit by the CacheFirst rule in src/sw.ts —
        // content-hashed filenames make that safe.
        globPatterns: [
          "index.html",
          "offline.html",
          // Entry chunk + the small page chunks Rollup also names "index-*"
          // (src/pages/Index.tsx), plus the main stylesheet.
          "assets/index-*.js",
          "assets/index-*.css",
          // Framework vendors needed before anything can render.
          "assets/vendor-react-*.js",
          "assets/vendor-ui-*.js",
          "assets/vendor-query-*.js",
          "assets/vendor-i18n-*.js",
          "fonts/*.woff2",
        ],
        // Safety net: if someone later widens globPatterns, these stay out.
        //   Monaco + language workers ~11.1 MB (desktop-only, theme devs)
        //   marketplace thumbnails    ~3.2 MB
        //   vendor-sentry             ~259 KB, not needed for first paint
        //   vendor-charts             ~433 KB, runtime-cached on first dashboard visit
        globIgnores: [
          "**/*.worker-*.js",
          "**/ThemeCodeEditor-*.{js,css}",
          "**/marketplace-thumbs/**",
          "**/vendor-sentry-*.js",
          "**/vendor-charts-*.js",
        ],
        // The build FAILS if any single precached file exceeds this.
        // vite-plugin-pwa >= 0.20.2 errors rather than warns.
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },

      // The SW is validated against `npm run preview`, not `npm run dev`.
      devOptions: { enabled: false, type: "module" },

      manifest: {
        id: "/",
        name: "NUMU Merchant",
        short_name: "NUMU",
        description:
          "Manage your NUMU store — orders, products, customers and payments.",
        // ?source=pwa gives us free install attribution in analytics.
        start_url: "/?source=pwa",
        scope: "/",
        display: "standalone",
        display_override: [
          "window-controls-overlay",
          "standalone",
          "minimal-ui",
          "browser",
        ],
        background_color: "#FFFFFF",
        theme_color: "#14253D",
        // `orientation` is deliberately OMITTED: merchants rotate to landscape
        // to read order tables, and locking to portrait would be hostile.
        lang: "ar",
        dir: "auto",
        categories: ["business", "productivity", "shopping"],
        icons: [
          { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          // Measured 2026-08-08: the source art's mark sits 190px from centre
          // vs the 205px safe radius, so it is maskable-safe as-is. Kept as a
          // separate file (currently byte-identical to icon-512) so it can
          // diverge later without a manifest change.
          { src: "/pwa/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
        ],
        // Unlocks Chrome's richer install dialog — an app card with imagery
        // instead of a bare "Install?" bar, which is a real conversion
        // difference on the one surface where merchants decide.
        //
        // Captured from a TEST store (qalab) at 360 CSS px / DPR 3, because
        // the manifest is PUBLIC. No customer names, phones or addresses
        // appear in any of them. Each is framed past the transient wallet
        // banner so the dialog shows the product rather than a warning.
        //
        // `sizes` must match the files exactly or Chrome ignores the entry.
        screenshots: [
          {
            src: "/pwa/shot-mobile-1.png",
            sizes: "1080x1920",
            type: "image/png",
            form_factor: "narrow",
            label: "Your store at a glance",
          },
          {
            src: "/pwa/shot-mobile-2.png",
            sizes: "1080x1920",
            type: "image/png",
            form_factor: "narrow",
            label: "Orders, built for one hand",
          },
          {
            src: "/pwa/shot-mobile-3.png",
            sizes: "1080x1920",
            type: "image/png",
            form_factor: "narrow",
            label: "Manage your products",
          },
          {
            src: "/pwa/shot-wide-1.png",
            sizes: "1920x1080",
            type: "image/png",
            form_factor: "wide",
            label: "The full dashboard on desktop",
          },
        ],
        shortcuts: [
          { name: "الطلبات · Orders", url: "/orders" },
          { name: "طلب جديد · New order", url: "/orders/create" },
          { name: "المنتجات · Products", url: "/products" },
          { name: "التحليلات · Analytics", url: "/analytics/overview" },
        ],
      },
    }),
    vitePluginCSP(),
    viteStripHeavyPreloads(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  build: {
    target: ["es2020", "safari14"],
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-popover",
            "@radix-ui/react-dropdown-menu",
          ],
          "vendor-charts": ["recharts"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-i18n": [
            "i18next",
            "react-i18next",
            "i18next-browser-languagedetector",
          ],
          "vendor-sentry": ["@sentry/react"],
        },
      },
    },
  },
  esbuild: {
    drop: mode === "production" ? ["debugger"] : [],
    pure:
      mode === "production"
        ? ["console.log", "console.debug", "console.info"]
        : [],
  },
}));
