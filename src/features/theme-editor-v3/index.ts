/**
 * Theme Editor V3 — Feature module barrel export.
 *
 * Usage in router:
 *   import { ThemeCustomizerV3 } from "@/features/theme-editor-v3";
 *
 *   <Route path="/online-store/customize-v3/:storeId" element={<ThemeCustomizerV3 />} />
 */

export { ThemeCustomizerV3 } from "./pages/ThemeCustomizerV3";
export { useCustomizerStore } from "./store/customizerStore";
export type * from "./types";
