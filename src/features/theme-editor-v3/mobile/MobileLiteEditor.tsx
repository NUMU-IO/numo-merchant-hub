/**
 * Mobile Lite Theme Editor.
 *
 * A SECOND CONTROL LAYER over the existing V3 editor — not a second editor.
 * It consumes the same Zustand store, the same schemas and the same
 * save/publish path as the desktop customizer. It defines no theme types, no
 * draft state and no persistence of its own, and it introduces no API endpoint.
 *
 * What it deliberately does NOT do (all desktop-only, see PWA overview §9d):
 *   Monaco / custom CSS / custom JS · add or remove sections · block editing ·
 *   section groups · app embeds · wording panel · version history · discard
 *   draft · theme variants · dynamic sources · focal-point editing.
 *
 * Monaco is not merely excluded here — it lives on a different route entirely
 * (`/online-store/themes/code-editor`) and nothing in this module imports it,
 * so its ~11.1 MB can never enter this chunk.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, Palette, Rocket, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDashboardStore } from "@/contexts/StoreContext";
import { toast } from "sonner";

import { useCustomizerStore } from "../store/customizerStore";
import { findSectionSchema } from "../store/blockPaths";
import { LivePreview } from "../components/preview/LivePreview";
import type { SectionInstance } from "../types";
import { MobileSectionList } from "./MobileSectionList";
import { MobileSettingsForm } from "./MobileSettingsForm";
import { MobilePublishConfirm } from "./MobilePublishConfirm";

export function MobileLiteEditor() {
  const { isRTL } = useLanguage();
  const isAr = isRTL;
  const navigate = useNavigate();
  const { currentStore } = useDashboardStore();
  const storeId = currentStore?.id ?? null;

  const draft = useCustomizerStore((s) => s.draft);
  const schemas = useCustomizerStore((s) => s.schemas);
  const locale = useCustomizerStore((s) => s.locale);
  const setLocale = useCustomizerStore((s) => s.setLocale);
  const activePage = useCustomizerStore((s) => s.activePage);
  const isLoading = useCustomizerStore((s) => s.isLoading);
  const isSaving = useCustomizerStore((s) => s.isSaving);
  const isPublishing = useCustomizerStore((s) => s.isPublishing);
  const isDirty = useCustomizerStore((s) => s.isDirty);
  const error = useCustomizerStore((s) => s.error);
  const sessionExpired = useCustomizerStore((s) => s.sessionExpired);
  const editConflict = useCustomizerStore((s) => s.editConflict);
  const lastPublish = useCustomizerStore((s) => s.lastPublish);

  const initialize = useCustomizerStore((s) => s.initialize);
  const reset = useCustomizerStore((s) => s.reset);
  const flushPendingSave = useCustomizerStore((s) => s.flushPendingSave);
  const setDeviceMode = useCustomizerStore((s) => s.setDeviceMode);
  const updateSectionSetting = useCustomizerStore((s) => s.updateSectionSetting);
  const updateGlobalSetting = useCustomizerStore((s) => s.updateGlobalSetting);
  const toggleSection = useCustomizerStore((s) => s.toggleSection);
  const moveSection = useCustomizerStore((s) => s.moveSection);
  const save = useCustomizerStore((s) => s.save);
  const publish = useCustomizerStore((s) => s.publish);
  const retryAfterReauth = useCustomizerStore((s) => s.retryAfterReauth);
  const resolveConflictReload = useCustomizerStore((s) => s.resolveConflictReload);
  const resolveConflictKeepMine = useCustomizerStore((s) => s.resolveConflictKeepMine);

  const [openSectionId, setOpenSectionId] = useState<string | null>(null);
  const [themeSheetOpen, setThemeSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Same lifecycle as the desktop page: load on mount, flush the debounced
  // autosave BEFORE reset() wipes the draft, then reset.
  useEffect(() => {
    if (!storeId) return;
    initialize(storeId);
    return () => {
      flushPendingSave();
      reset();
    };
  }, [storeId, initialize, reset, flushPendingSave]);

  // Frame the preview as a phone — this editor only ever runs below `md`.
  useEffect(() => {
    setDeviceMode("mobile");
  }, [setDeviceMode]);

  useEffect(() => {
    const lang = currentStore?.default_language;
    if (lang === "ar" || lang === "en") setLocale(lang);
  }, [currentStore?.default_language, setLocale]);

  const template = draft?.templates?.[activePage] ?? null;
  const openSection: SectionInstance | null = openSectionId
    ? (template?.sections?.[openSectionId] ?? null)
    : null;

  // 3-pool lookup, exactly as the desktop SectionEditorPanel does. Chrome
  // sections (`tag: "header"` / `"footer"`) are filtered OUT of
  // `schemas.sections` by normalizeSchemas and live in
  // `schemas.section_groups` instead — so a single-pool `schemas.sections.find`
  // returns undefined for every header and footer. That made the sheet fall
  // back to the raw type as its title and render "no settings you can edit on
  // a phone" for sections that in fact have 22 (vionne-header) and 14
  // (vionne-footer) allowlisted settings. Every theme in the fleet tags its
  // chrome this way — the CLI's `navigability` rule requires it.
  const openSectionSchema = useMemo(
    () => (openSection ? findSectionSchema(schemas, openSection.type) : undefined),
    [schemas, openSection],
  );

  // The section LIST needs the same three pools, for the same reason: without
  // the chrome pools `sectionName()` finds no schema and falls back to the raw
  // type, so the two most-edited rows read "vionne-header" / "vionne-footer"
  // instead of "Vionne Header" / "Vionne Footer".
  const allSectionSchemas = useMemo(
    () => [
      ...(schemas?.sections ?? []),
      ...(schemas?.section_groups?.header?.sections ?? []),
      ...(schemas?.section_groups?.footer?.sections ?? []),
    ],
    [schemas],
  );

  const sectionTitle = openSectionSchema
    ? locale === "ar"
      ? openSectionSchema.locales?.ar?.name || openSectionSchema.name
      : openSectionSchema.name
    : (openSection?.type ?? "");

  const Back = isRTL ? ArrowRight : ArrowLeft;

  const handlePublish = async () => {
    setConfirmOpen(false);
    try {
      await publish();
      // Report the store's OWN outcome, not a blanket success — `publish`
      // distinguishes "live" from "saved but the storefront refresh lagged",
      // and claiming the former when it was the latter sends merchants hunting
      // for changes that are not visible yet.
      const verified = useCustomizerStore.getState().lastPublish?.revalidated;
      if (verified === false) {
        toast.warning(
          isAr
            ? "اتحفظ، بس تحديث المتجر اتأخر شوية"
            : "Saved — the storefront refresh is delayed",
        );
      } else {
        toast.success(isAr ? "المتجر اتحدّث" : "Your store is updated");
      }
    } catch {
      toast.error(isAr ? "النشر فشل" : "Publish failed");
    }
  };

  if (!storeId) {
    return (
      <div className="grid min-h-[100dvh] place-items-center p-6 text-center">
        <p className="text-[15px] text-muted-foreground">
          {isAr ? "اختار متجر الأول" : "Pick a store first"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="safe-top sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-background/95 px-2 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => navigate("/online-store/themes")}
          aria-label={isAr ? "رجوع" : "Back"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
        >
          <Back className="h-5 w-5" />
        </button>

        <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">
          {isAr ? "تصميم المتجر" : "Customize"}
        </span>

        <Button
          type="button"
          variant="ghost"
          onClick={() => void save()}
          disabled={!isDirty || isSaving}
          className="h-11 rounded-xl px-3 text-[13px] font-bold"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isDirty ? (
            isAr ? (
              "حفظ"
            ) : (
              "Save"
            )
          ) : (
            <Check className="h-4 w-4 text-sage" />
          )}
        </Button>

        <Button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={isPublishing}
          className="h-11 rounded-xl px-3.5 text-[13px] font-bold"
        >
          <Rocket className="me-1.5 h-3.5 w-3.5" />
          {isAr ? "نشر" : "Publish"}
        </Button>
      </header>

      {/* ── Blocking states, surfaced rather than swallowed ──────────────── */}
      {sessionExpired && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-950/40">
          <p className="text-[13px] font-semibold text-amber-900 dark:text-amber-200">
            {isAr ? "الجلسة انتهت — سجّل دخول تاني" : "Session expired — sign in again"}
          </p>
          <Button
            type="button"
            size="sm"
            className="mt-2 h-10 rounded-lg"
            onClick={() => void retryAfterReauth()}
          >
            {isAr ? "إعادة المحاولة" : "Retry"}
          </Button>
        </div>
      )}

      {editConflict && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-[13px] font-semibold">
            {isAr
              ? "حد تاني عدّل التصميم من جهاز تاني"
              : "Someone edited this theme on another device"}
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-10 rounded-lg"
              onClick={resolveConflictReload}
            >
              {isAr ? "حمّل الأحدث" : "Load theirs"}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-10 rounded-lg"
              onClick={() => void resolveConflictKeepMine()}
            >
              {isAr ? "احتفظ بتعديلاتي" : "Keep mine"}
            </Button>
          </div>
        </div>
      )}

      {error && !sessionExpired && !editConflict && (
        <p className="border-b border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-semibold text-destructive">
          {error}
        </p>
      )}

      {/* ── Live preview — the SAME prop-free component the desktop uses ── */}
      <div className="relative h-[42dvh] shrink-0 overflow-hidden border-b border-border bg-muted/30">
        {isLoading ? (
          <div className="grid h-full place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <LivePreview />
        )}
      </div>

      {/* ── Sections ────────────────────────────────────────────────────── */}
      <main className="flex-1 space-y-3 p-3 pb-24">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : (
          <>
            <h2 className="souq-eyebrow px-1">§ {isAr ? "الأقسام" : "Sections"}</h2>
            <MobileSectionList
              template={template}
              schemas={allSectionSchemas}
              locale={locale}
              isRTL={isRTL}
              onOpen={setOpenSectionId}
              onToggle={toggleSection}
              onMove={moveSection}
            />

            <button
              type="button"
              onClick={() => setThemeSheetOpen(true)}
              className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl border border-border bg-card px-3 text-start"
            >
              <span className="ichip ichip-navy shrink-0">
                <Palette className="h-5 w-5" />
              </span>
              <span className="flex-1 text-[15px] font-bold">
                {isAr ? "إعدادات التصميم" : "Theme settings"}
              </span>
            </button>
          </>
        )}
      </main>

      {/* ── Section settings sheet ──────────────────────────────────────── */}
      <Sheet open={!!openSectionId} onOpenChange={(o) => !o && setOpenSectionId(null)}>
        <SheetContent side="bottom" className="flex max-h-[88dvh] flex-col rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-start text-base font-extrabold">{sectionTitle}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-3">
            {openSection && openSectionId && (
              <MobileSettingsForm
                settings={openSectionSchema?.settings}
                values={openSection.settings ?? {}}
                locale={locale}
                storeId={storeId}
                emptyLabel={
                  isAr
                    ? "القسم ده مفيهوش إعدادات تتظبط من الموبايل"
                    : "This section has no settings you can edit on a phone"
                }
                onChange={(key, value) => updateSectionSetting(openSectionId, key, value)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Theme settings sheet ────────────────────────────────────────── */}
      {/* Always available, even when a theme ships 0 global settings (empire
          does). Hiding it on those themes would make the editor's shape differ
          per theme, which is harder to support than an honest empty state. */}
      <Sheet open={themeSheetOpen} onOpenChange={setThemeSheetOpen}>
        <SheetContent side="bottom" className="flex max-h-[88dvh] flex-col rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-start text-base font-extrabold">
              {isAr ? "إعدادات التصميم" : "Theme settings"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-3">
            <MobileSettingsForm
              settings={schemas?.global_settings}
              values={draft?.global_settings ?? {}}
              locale={locale}
              storeId={storeId}
              emptyLabel={
                isAr
                  ? "التصميم ده مفيهوش إعدادات عامة — ظبّط الأقسام بدل كده"
                  : "This theme has no global settings — edit its sections instead"
              }
              onChange={updateGlobalSetting}
            />
          </div>
        </SheetContent>
      </Sheet>

      <MobilePublishConfirm
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => void handlePublish()}
        isPublishing={isPublishing}
        storeName={currentStore?.name}
        isAr={isAr}
      />

      {lastPublish?.revalidated === false && (
        <p className="px-4 pb-4 text-center text-[12px] text-muted-foreground">
          {isAr
            ? "التغييرات اتحفظت — تحديث الواجهة ممكن ياخد دقايق"
            : "Saved — the storefront may take a few minutes to refresh"}
        </p>
      )}
    </div>
  );
}
