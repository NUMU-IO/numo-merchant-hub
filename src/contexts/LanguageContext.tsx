import React, { createContext, useCallback, useContext, useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  isRTL: boolean;
  /** True while a switch is in flight — the header toggle shows a spinner. */
  isSwitching: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: async () => {},
  isRTL: false,
  isSwitching: false,
});

/** Collapse i18next's resolved tag ("ar-EG", "en-US") to the two the hub ships. */
function normalise(tag: string | undefined): "ar" | "en" {
  return tag && tag.toLowerCase().startsWith("ar") ? "ar" : "en";
}

function applyDocumentDirection(lang: "ar" | "en") {
  const root = document.documentElement;
  root.dir = lang === "ar" ? "rtl" : "ltr";
  root.lang = lang;
}

/* Language switching used to be non-atomic: this provider kept its OWN
   `language` state and flipped it synchronously while `i18n.changeLanguage`
   (not awaited) re-rendered `useTranslation()` consumers on a later tick —
   so the ~200 files using `isAr ?` ternaries switched before the ~80 using
   `t()`, and `dir` was set in a `useEffect`, i.e. after paint. The reviewer
   saw the toggle flip to "ع" while the page stayed English, then a second
   transition.

   Now i18next is the single source of truth: `language` is derived from
   `i18n.resolvedLanguage`, so every consumer (ternary or `t()`) re-renders
   in the same `languageChanged` batch, and `dir`/`lang` are written to the
   document synchronously BEFORE the switch so RTL layout and Arabic text
   land in one frame. */
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const language = normalise(i18n.resolvedLanguage ?? i18n.language);
  const [isSwitching, setIsSwitching] = useState(false);

  // Initial load: the detector may have restored "ar" from localStorage
  // before React mounted — make the document agree before first paint.
  useLayoutEffect(() => {
    applyDocumentDirection(language);
  }, [language]);

  const setLanguage = useCallback(
    async (lang: string) => {
      const next = normalise(lang);
      if (next === language) return;
      setIsSwitching(true);
      try {
        applyDocumentDirection(next);
        await i18n.changeLanguage(next);
      } finally {
        setIsSwitching(false);
      }
    },
    [i18n, language],
  );

  const isRTL = language === "ar";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL, isSwitching }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
