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
                "connect-src 'self' https://numueg.tech https://*.numueg.tech https://*.numu.store https://*.sentry.io https://*.ingest.sentry.io",
                "frame-src 'self' https://numueg.tech https://*.numueg.tech https://*.numu.store",
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
        // After SSL cert is issued, change to: https://numueg.tech
        target: "http://188.166.156.151",
        changeOrigin: true,
        cookieDomainRewrite: "",
        secure: false,
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-select", "@radix-ui/react-tabs", "@radix-ui/react-tooltip", "@radix-ui/react-popover", "@radix-ui/react-dropdown-menu"],
          "vendor-charts": ["recharts"],
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
  },
  esbuild: {
    drop: mode === "production" ? ["debugger"] : [],
    pure: mode === "production" ? ["console.log", "console.debug", "console.info"] : [],
  },
}));
