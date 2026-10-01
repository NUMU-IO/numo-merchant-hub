import { useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

// The message of the form currently holding unsaved changes, or null.
// ponytail: one slot — two dirty forms mounted at once share it; a per-form
// registry if that ever happens.
let leaveMessage: string | null = null;

/**
 * For navigation that doesn't go through a link (bottom nav, menus calling
 * navigate()): true when it is fine to leave, asking first while a form
 * has unsaved changes.
 */
export function confirmLeave(): boolean {
  return leaveMessage === null || window.confirm(leaveMessage);
}

/**
 * Warn before unsaved form changes are lost: on tab close/reload
 * (beforeunload), on in-app link clicks, and wherever navigation code calls
 * confirmLeave(). The app uses BrowserRouter, so react-router's useBlocker
 * isn't available; the browser Back button is not caught.
 */
export function useUnsavedChangesGuard(dirty: boolean): void {
  const { language } = useLanguage();

  useEffect(() => {
    if (!dirty) return;
    leaveMessage =
      language === "ar"
        ? "عندك تعديلات مش محفوظة. تخرج من غير ما تحفظ؟"
        : "You have unsaved changes. Leave without saving?";

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onLinkClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!link || link.getAttribute("target") === "_blank") return;
      if (link.getAttribute("href")?.startsWith("#")) return;
      if (!confirmLeave()) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onLinkClick, true);
    return () => {
      leaveMessage = null;
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onLinkClick, true);
    };
  }, [dirty, language]);
}
