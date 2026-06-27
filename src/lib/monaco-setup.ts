/**
 * Self-hosted Monaco setup.
 *
 * `@monaco-editor/react` loads the Monaco engine from the jsdelivr CDN by
 * default. On the deployed hub that CDN is blocked (CSP / network), so the
 * editor hangs forever on "Loading…". Here we bundle Monaco with the app via
 * Vite and point the loader at it, plus wire the language web-workers with
 * Vite's `?worker` imports — so the code editor works fully offline / behind
 * any CSP, with TS/JSON/CSS/HTML language services intact.
 *
 * Import this module once for its side effects before the <Editor> mounts
 * (done at the top of ThemeCodeEditor). Importing it here (not in main.tsx)
 * keeps the ~5MB Monaco bundle out of the initial app load — it ships only
 * with the Edit-code route's chunk.
 */

import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";

// Monaco asks for a worker by language label; hand back the matching bundled
// worker (falls back to the generic editor worker).
self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    switch (label) {
      case "json":
        return new jsonWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      case "typescript":
      case "javascript":
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

// Use the bundled Monaco instead of fetching it from a CDN.
loader.config({ monaco });
