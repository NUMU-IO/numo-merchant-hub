import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Injects Content-Security-Policy meta tag only in production builds.
 * In dev mode, Vite's HMR requires inline scripts and cross-port API calls which CSP would block.
 */
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
              content: [
                "default-src 'self'",
                "script-src 'self'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: blob: https:",
                "connect-src 'self' https://*.numu.store https://*.sentry.io https://*.ingest.sentry.io",
                "frame-src 'self' https://*.numu.store",
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
        target: "http://localhost:8021",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), vitePluginCSP()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  esbuild: {
    drop: mode === "production" ? ["debugger"] : [],
    pure: mode === "production" ? ["console.log", "console.debug", "console.info"] : [],
  },
  build: {
    // Split vendor chunks so browsers can cache stable deps separately and
    // download multiple chunks in parallel on first load.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Heavy charting library — only needed on analytics pages
          if (id.includes("recharts") || id.includes("/d3-")) return "charts";
          // Error monitoring — non-critical for initial render
          if (id.includes("@sentry/")) return "sentry";
          // i18n — loads separately, rarely changes
          if (id.includes("i18next") || id.includes("react-i18next")) return "i18n";
          // Radix UI primitives — large but stable
          if (id.includes("@radix-ui/")) return "radix";
          // React core + router
          if (id.includes("react-dom") || id.includes("react-router")) return "react";
          // TanStack Query
          if (id.includes("@tanstack/")) return "tanstack";
          // Everything else (date-fns, zod, lucide, etc.)
          return "vendor";
        },
      },
    },
  },
}));
