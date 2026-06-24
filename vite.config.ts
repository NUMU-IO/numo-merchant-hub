import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

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
        target: "http://127.0.0.1:8001",
        changeOrigin: true,
        cookieDomainRewrite: "",
        secure: false,
      },
    },
  },
  plugins: [react(), vitePluginCSP(), viteStripHeavyPreloads()],
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
