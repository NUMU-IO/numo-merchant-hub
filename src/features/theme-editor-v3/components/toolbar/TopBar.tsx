/**
 * TopBar — The main toolbar for the V3 theme customizer.
 *
 * Features:
 *  - Back button to exit customizer
 *  - Page selector (home, product, collection, etc.)
 *  - Device mode switcher (desktop/tablet/mobile)
 *  - Bilingual toggle (EN/AR)
 *  - Undo/Redo buttons with keyboard shortcuts
 *  - Auto-save status indicator
 *  - Discard changes button
 *  - Publish button
 *  - Version history toggle
 */

import { useState, useCallback, useEffect } from "react";
import {
  ArrowLeft,
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  History,
  Loader2,
  Check,
  Cloud,
  CloudOff,
  X,
  ExternalLink,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useCustomizerStore,
  selectCanUndo,
  selectCanRedo,
} from "../../store/customizerStore";
import { PreviewResourcePicker } from "./PreviewResourcePicker";
import { CreateTemplateDialog } from "./CreateTemplateDialog";
import type { DeviceMode, EditorLocale } from "../../types";
import { PrePublishDiffDialog } from "../panels/PrePublishDiffDialog";

// ─── Device buttons config ──────────────────────────────────────────────────

const DEVICES: { mode: DeviceMode; icon: typeof Monitor; label: Record<EditorLocale, string> }[] = [
  { mode: "desktop", icon: Monitor, label: { en: "Desktop", ar: "سطح المكتب" } },
  { mode: "tablet", icon: Tablet, label: { en: "Tablet", ar: "جهاز لوحي" } },
  { mode: "mobile", icon: Smartphone, label: { en: "Mobile", ar: "هاتف" } },
];

// ─── Page options ───────────────────────────────────────────────────────────

// Canonical V3 template list — these are the templates a merchant can
// navigate to in the editor. Names match the backend's PageTemplate keys
// produced by `generate_initial_v3_customization` and the storefront's
// route-to-template mapping (`templateForPath` in ByotV3Outlet).
//
// Why canonical (not derived from `draft.templates`):
//   - Empty templates ARE meaningful — a merchant flipping to "Product"
//     should see a "no sections yet, add one" empty state, not have the
//     option hidden until someone seeds it.
//   - Themes evolve their preset library between versions; a draft
//     seeded against v0.1 of a theme won't have the cart template that
//     v0.2 introduced. Surfacing the full canonical list lets the
//     merchant author any template on demand.
//   - Matches Shopify's UX: all template kinds are always available.
//
// Each entry's `value` MUST match the storefront's path→template mapping
// in `numu-egyptian-bazaar/src/components/store/ByotV3Outlet.tsx ::
// templateForPath()` so a merchant viewing /product/<id> sees the
// product template selected here.
const PAGES: { value: string; label: Record<EditorLocale, string> }[] = [
  { value: "home", label: { en: "Home", ar: "الرئيسية" } },
  { value: "products", label: { en: "Products", ar: "المنتجات" } },
  { value: "product", label: { en: "Product", ar: "المنتج" } },
  { value: "collection", label: { en: "Collection", ar: "المجموعة" } },
  { value: "cart", label: { en: "Cart", ar: "السلة" } },
  { value: "search", label: { en: "Search", ar: "البحث" } },
  { value: "checkout", label: { en: "Checkout", ar: "الدفع" } },
  { value: "order-confirmation", label: { en: "Order confirmation", ar: "تأكيد الطلب" } },
  { value: "profile", label: { en: "Profile", ar: "الحساب" } },
  { value: "about", label: { en: "About", ar: "من نحن" } },
  { value: "contact", label: { en: "Contact", ar: "تواصل معنا" } },
  { value: "page", label: { en: "Page", ar: "صفحة" } },
  { value: "404", label: { en: "404 — Not found", ar: "404 — غير موجود" } },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface TopBarProps {
  onBack: () => void;
  onToggleVersionHistory: () => void;
  showVersionHistory: boolean;
  /** Storefront URL for the active store. Null if subdomain isn't known yet. */
  viewStoreUrl: string | null;
}

export function TopBar({
  onBack,
  onToggleVersionHistory,
  showVersionHistory,
  viewStoreUrl,
}: TopBarProps) {
  const locale = useCustomizerStore((s) => s.locale);
  const setLocale = useCustomizerStore((s) => s.setLocale);
  const deviceMode = useCustomizerStore((s) => s.deviceMode);
  const setDeviceMode = useCustomizerStore((s) => s.setDeviceMode);
  const activePage = useCustomizerStore((s) => s.activePage);
  const setActivePage = useCustomizerStore((s) => s.setActivePage);
  const isDirty = useCustomizerStore((s) => s.isDirty);
  const isSaving = useCustomizerStore((s) => s.isSaving);
  const isPublishing = useCustomizerStore((s) => s.isPublishing);
  const canUndo = useCustomizerStore(selectCanUndo);
  const canRedo = useCustomizerStore(selectCanRedo);
  const undo = useCustomizerStore((s) => s.undo);
  const redo = useCustomizerStore((s) => s.redo);
  const publish = useCustomizerStore((s) => s.publish);
  const discardDraft = useCustomizerStore((s) => s.discardDraft);
  const lastPublish = useCustomizerStore((s) => s.lastPublish);

  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showPrePublishDiff, setShowPrePublishDiff] = useState(false);
  const [publishLabel, setPublishLabel] = useState("");
  const draft = useCustomizerStore((s) => s.draft);
  const storeId = useCustomizerStore((s) => s.storeId);

  // Keyboard shortcuts for undo/redo (Phase 2.4 — also surfaced in the
  // toolbar tooltips so merchants can discover them).
  //
  // Cmd/Ctrl+Z       → undo
  // Cmd/Ctrl+Shift+Z → redo (Mac convention)
  // Cmd/Ctrl+Y       → redo (Windows convention)
  //
  // Skip the binding when focus is in a text input / textarea / select
  // / contenteditable — the browser's native input-undo should win
  // over the customizer's undo for in-progress keystrokes. Setting-
  // value bursts that should hit the customizer's stack land via the
  // field's onBlur → pushHistory pipeline, not the live keystroke.
  useEffect(() => {
    function inEditableTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      if (t.isContentEditable) return true;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    }
    function handleKeyDown(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;
      if (inEditableTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      } else if ((key === "z" && e.shiftKey) || key === "y") {
        e.preventDefault();
        if (canRedo) redo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  const handlePublish = useCallback(async () => {
    const isAr = locale === "ar";
    try {
      await publish(publishLabel || undefined);
    } catch {
      toast.error(
        isAr ? "فشل النشر" : "Publish failed",
        {
          description: isAr
            ? "تعذّر نشر تغييراتك. حاول مرة أخرى."
            : "We couldn't publish your changes. Please try again.",
        },
      );
      return;
    } finally {
      setShowPublishDialog(false);
      setPublishLabel("");
    }
    // A conflict / expired session aborts publish via its own banner/overlay —
    // don't toast a misleading "Live" over it.
    const state = useCustomizerStore.getState();
    if (state.editConflict || state.sessionExpired) return;
    const result = state.lastPublish;
    if (!result) return;
    if (result.revalidated === false) {
      // Committed, but the storefront refresh wasn't confirmed — be honest.
      toast.warning(
        isAr
          ? "تم الحفظ — قد يتأخر تحديث المتجر"
          : "Saved — storefront refresh delayed",
        {
          description: isAr
            ? "نُشرت تغييراتك لكن لم يتأكد تحديث المتجر بعد. قد يستغرق حتى دقيقة."
            : "Your changes are published, but the storefront refresh wasn't confirmed. It may take up to a minute to appear.",
        },
      );
    } else {
      toast.success(isAr ? "تم النشر ✓ مباشر الآن" : "Published ✓ Live now", {
        description: isAr
          ? "متجرك يعرض أحدث التغييرات."
          : "Your storefront is now serving the latest changes.",
      });
    }
  }, [publish, publishLabel, locale]);

  const handleDiscard = useCallback(async () => {
    await discardDraft();
    setShowDiscardDialog(false);
  }, [discardDraft]);

  // Template epic — alternate-template variants the merchant has created
  // (keys like `product.wholesale`). Surfaced in the page picker beneath the
  // canonical bases so they're navigable + editable like any template.
  const variantKeys = Object.keys(draft?.templates ?? {})
    .filter((k) => k.includes("."))
    .sort();
  const activeBase = activePage.split(".")[0];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-14 items-center justify-between border-b bg-background px-3">
        {/* ── Left section ── */}
        <div className="flex items-center gap-2">
          {/* Back button.
              Phase 5.7 — aria-label so screen readers announce the
              action even when the tooltip is closed. Tooltip text
              alone is only announced when the tooltip is open. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onBack}
                aria-label={locale === "ar" ? "رجوع" : "Back"}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{locale === "ar" ? "رجوع" : "Back"}</TooltipContent>
          </Tooltip>

          {/* Separator */}
          <div className="h-6 w-px bg-border" />

          {/* Page selector + (when on a resource template) the preview
              resource picker. Sitting them side-by-side keeps the
              merchant's mental model: "I'm editing the {Page} template
              while previewing it against {Resource}." */}
          <Select value={activePage} onValueChange={setActivePage}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGES.map((p) => {
                const exists = Boolean(draft?.templates?.[p.value]);
                return (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center justify-between gap-2 w-full">
                      <span>{p.label[locale]}</span>
                      {!exists && (
                        <span
                          className="text-[10px] text-muted-foreground/80"
                          title={
                            locale === "ar"
                              ? "لم يُنشأ بعد — أضف قسمًا للبدء"
                              : "Not yet set up — add a section to start"
                          }
                        >
                          {locale === "ar" ? "فارغ" : "empty"}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
              {/* Alternate-template variants (product.wholesale, page.about, …) */}
              {variantKeys.length > 0 && (
                <div className="my-1 border-t border-border" role="presentation" />
              )}
              {variantKeys.map((key) => (
                <SelectItem key={key} value={key}>
                  <span className="font-mono text-[11px]">
                    {draft?.templates?.[key]?.name || key}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Create alternate-template variant */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowCreateTemplate(true)}
                aria-label={
                  locale === "ar" ? "إنشاء قالب بديل" : "Create template variant"
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {locale === "ar" ? "إنشاء قالب بديل" : "Create template variant"}
            </TooltipContent>
          </Tooltip>

          {/* Preview resource picker — auto-hides for non-resource templates. */}
          <PreviewResourcePicker />
        </div>

        {/* ── Center section ── */}
        <div className="flex items-center gap-1">
          {/* Device switcher — segmented control.
              Phase 5.7 — wrapped in role="group" with an aria-label so
              screen readers describe the cluster as a unit. Each
              button gets aria-pressed to convey its toggle state and
              an aria-label for the device name (the icon alone has
              no accessible name). */}
          <div
            role="group"
            aria-label={locale === "ar" ? "وضع الجهاز" : "Device mode"}
            className="flex items-center gap-1"
          >
            {DEVICES.map(({ mode, icon: Icon, label }) => (
              <Tooltip key={mode}>
                <TooltipTrigger asChild>
                  <Button
                    variant={deviceMode === mode ? "secondary" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-8 w-8",
                      deviceMode === mode && "bg-accent",
                    )}
                    onClick={() => setDeviceMode(mode)}
                    aria-pressed={deviceMode === mode ? "true" : "false"}
                    aria-label={label[locale]}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label[locale]}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-border mx-1" />

          {/* Undo/Redo. Phase 5.7 — aria-label includes the keyboard
              shortcut so users discover Cmd+Z without needing to
              hover (matters for keyboard-only users who can't
              discover via tooltip). */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!canUndo}
                onClick={undo}
                aria-label={locale === "ar" ? "تراجع (Ctrl+Z)" : "Undo (Ctrl+Z)"}
                aria-keyshortcuts="Control+Z"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {locale === "ar" ? "تراجع (Ctrl+Z)" : "Undo (Ctrl+Z)"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!canRedo}
                onClick={redo}
                aria-label={locale === "ar" ? "إعادة (Ctrl+Y)" : "Redo (Ctrl+Y)"}
                aria-keyshortcuts="Control+Y"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {locale === "ar" ? "إعادة (Ctrl+Y)" : "Redo (Ctrl+Y)"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* ── Right section ── */}
        <div className="flex items-center gap-2">
          {/*
            Status indicator — Shopify-parity wording (per doc §34).

            Old labels said "Saved" which a non-technical merchant easily
            reads as "Saved live, customers can see it." That's wrong:
            the V3 autosave only persists the DRAFT — the merchant
            still has to click Publish for changes to reach shoppers.

            New labels:
              - "Publishing…"     while publish is in flight
              - "Saving…"         while autosave is in flight
              - "Unsaved draft"   when local changes haven't autosaved yet
              - "Draft saved"     when the draft is persisted but unpublished
                                  (the new default state — replaces "Saved")

            The Publish button is unchanged; this is purely about
            communicating that "Saved" means "Saved to your draft, not
            live."
          */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isPublishing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{locale === "ar" ? "جاري النشر..." : "Publishing…"}</span>
              </>
            ) : isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{locale === "ar" ? "جاري الحفظ..." : "Saving…"}</span>
              </>
            ) : isDirty ? (
              <>
                <CloudOff className="h-3 w-3 text-amber-500" />
                <span className="text-amber-600">
                  {locale === "ar" ? "مسودة غير محفوظة" : "Unsaved draft"}
                </span>
              </>
            ) : (
              <>
                <Cloud className="h-3 w-3 text-green-500" />
                <span>{locale === "ar" ? "تم حفظ المسودة" : "Draft saved"}</span>
              </>
            )}
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-border" />

          {/* Bilingual toggle — segmented control.
              Phase 5.7 — role="group" + aria-label names the cluster;
              each button uses aria-pressed for toggle semantics +
              focus-visible ring for keyboard-only users. */}
          <div
            role="group"
            aria-label={locale === "ar" ? "لغة التحرير" : "Editor language"}
            className="flex items-center rounded-md border bg-muted/50 p-0.5"
          >
            <button
              type="button"
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                locale === "en"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setLocale("en")}
              aria-pressed={locale === "en" ? "true" : "false"}
              aria-label="English"
            >
              EN
            </button>
            <button
              type="button"
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                locale === "ar"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setLocale("ar")}
              aria-pressed={locale === "ar" ? "true" : "false"}
              aria-label="العربية"
            >
              AR
            </button>
          </div>

          {/* View store — opens the live storefront in a new tab so the
              merchant can see the published version side-by-side with the
              draft they're editing. Disabled until the store's subdomain
              resolves (initial mount). */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!viewStoreUrl}
                onClick={() => {
                  if (!viewStoreUrl) return;
                  // Append a cache-buster keyed on the last published revision
                  // so the merchant's browser doesn't show a stale cached page
                  // right after publishing.
                  const v = lastPublish?.contentHash;
                  const target = v
                    ? `${viewStoreUrl}${viewStoreUrl.includes("?") ? "&" : "?"}v=${encodeURIComponent(v)}`
                    : viewStoreUrl;
                  window.open(target, "_blank", "noopener,noreferrer");
                }}
                aria-label={locale === "ar" ? "عرض المتجر" : "View store"}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {locale === "ar" ? "عرض المتجر" : "View store"}
            </TooltipContent>
          </Tooltip>

          {/* Version history toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showVersionHistory ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={onToggleVersionHistory}
                aria-pressed={showVersionHistory ? "true" : "false"}
                aria-label={locale === "ar" ? "سجل الإصدارات" : "Version History"}
              >
                <History className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {locale === "ar" ? "سجل الإصدارات" : "Version History"}
            </TooltipContent>
          </Tooltip>

          {/* Separator */}
          <div className="h-6 w-px bg-border" />

          {/* Discard button */}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={!isDirty || isSaving}
            onClick={() => setShowDiscardDialog(true)}
          >
            <X className="h-3.5 w-3.5" />
            {locale === "ar" ? "تجاهل" : "Discard"}
          </Button>

          {/* Publish button — Wave 7 opens the pre-publish diff modal
              first; merchant confirms inside that dialog, which then
              opens the legacy "version label" prompt before committing.
              Two-step flow is intentional: the diff is the "are you
              sure" gate, the label is the "what should this be
              called" gate. */}
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={isPublishing}
            onClick={() => setShowPrePublishDiff(true)}
          >
            {isPublishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            {locale === "ar" ? "نشر" : "Publish"}
          </Button>
        </div>
      </div>

      {/* ── Create template variant dialog (Template epic) ──
          Conditionally mounted so each open starts with a fresh suffix. */}
      {showCreateTemplate && (
        <CreateTemplateDialog
          open
          onOpenChange={(o) => setShowCreateTemplate(o)}
          defaultBase={activeBase}
        />
      )}

      {/* ── Discard confirmation dialog ── */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locale === "ar" ? "تجاهل التغييرات؟" : "Discard changes?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === "ar"
                ? "سيتم فقدان جميع التغييرات غير المنشورة. لا يمكن التراجع عن هذا الإجراء."
                : "All unpublished changes will be lost. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscard} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {locale === "ar" ? "تجاهل" : "Discard"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Pre-publish diff dialog (Wave 7) ──
          Opens FIRST when the merchant clicks Publish. After they
          confirm here, we open the version-label prompt to actually
          commit the publish. */}
      {draft && storeId && (
        <PrePublishDiffDialog
          open={showPrePublishDiff}
          onOpenChange={setShowPrePublishDiff}
          draft={draft}
          storeId={storeId}
          locale={locale}
          publishing={isPublishing}
          onConfirm={async () => {
            setShowPrePublishDiff(false);
            // Hand off to the legacy publish dialog so the merchant
            // can label the version. Keeping the two dialogs separate
            // means a merchant who only wants a quick publish without
            // a label can also skip the label step by hitting Publish
            // in the label dialog with an empty input.
            setShowPublishDialog(true);
          }}
        />
      )}

      {/* ── Publish dialog ── */}
      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {locale === "ar" ? "نشر التغييرات" : "Publish Changes"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {locale === "ar"
                ? "سيتم نشر التغييرات الحالية وستصبح مرئية للعملاء."
                : "Current changes will be published and visible to customers."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 py-2">
            <label className="text-sm font-medium">
              {locale === "ar" ? "تسمية الإصدار (اختياري)" : "Version label (optional)"}
            </label>
            <input
              type="text"
              value={publishLabel}
              onChange={(e) => setPublishLabel(e.target.value)}
              placeholder={locale === "ar" ? "مثال: تحديث الصفحة الرئيسية" : "e.g., Homepage update"}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              dir={locale === "ar" ? "rtl" : "ltr"}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {locale === "ar" ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {locale === "ar" ? "نشر" : "Publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
