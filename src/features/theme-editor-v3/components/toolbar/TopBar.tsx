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
import { cn } from "@/lib/utils";
import {
  useCustomizerStore,
  selectCanUndo,
  selectCanRedo,
} from "../../store/customizerStore";
import type { DeviceMode, EditorLocale } from "../../types";

// ─── Device buttons config ──────────────────────────────────────────────────

const DEVICES: { mode: DeviceMode; icon: typeof Monitor; label: Record<EditorLocale, string> }[] = [
  { mode: "desktop", icon: Monitor, label: { en: "Desktop", ar: "سطح المكتب" } },
  { mode: "tablet", icon: Tablet, label: { en: "Tablet", ar: "جهاز لوحي" } },
  { mode: "mobile", icon: Smartphone, label: { en: "Mobile", ar: "هاتف" } },
];

// ─── Page options ───────────────────────────────────────────────────────────

// Template keys must match the backend's PageTemplate map keys produced by
// `generate_initial_v3_customization` and `normalize_legacy_to_v3`.
const PAGES: { value: string; label: Record<EditorLocale, string> }[] = [
  { value: "home", label: { en: "Home", ar: "الرئيسية" } },
  { value: "product", label: { en: "Product", ar: "المنتج" } },
  { value: "collection", label: { en: "Collection", ar: "المجموعة" } },
  { value: "cart", label: { en: "Cart", ar: "السلة" } },
  { value: "blog", label: { en: "Blog", ar: "المدونة" } },
  { value: "page", label: { en: "Page", ar: "صفحة" } },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface TopBarProps {
  onBack: () => void;
  onToggleVersionHistory: () => void;
  showVersionHistory: boolean;
}

export function TopBar({ onBack, onToggleVersionHistory, showVersionHistory }: TopBarProps) {
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

  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [publishLabel, setPublishLabel] = useState("");

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }
      if (isMeta && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  const handlePublish = useCallback(async () => {
    await publish(publishLabel || undefined);
    setShowPublishDialog(false);
    setPublishLabel("");
  }, [publish, publishLabel]);

  const handleDiscard = useCallback(async () => {
    await discardDraft();
    setShowDiscardDialog(false);
  }, [discardDraft]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-14 items-center justify-between border-b bg-background px-3">
        {/* ── Left section ── */}
        <div className="flex items-center gap-2">
          {/* Back button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{locale === "ar" ? "رجوع" : "Back"}</TooltipContent>
          </Tooltip>

          {/* Separator */}
          <div className="h-6 w-px bg-border" />

          {/* Page selector */}
          <Select value={activePage} onValueChange={setActivePage}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label[locale]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ── Center section ── */}
        <div className="flex items-center gap-1">
          {/* Device switcher */}
          {DEVICES.map(({ mode, icon: Icon, label }) => (
            <Tooltip key={mode}>
              <TooltipTrigger asChild>
                <Button
                  variant={deviceMode === mode ? "secondary" : "ghost"}
                  size="icon"
                  className={cn("h-8 w-8", deviceMode === mode && "bg-accent")}
                  onClick={() => setDeviceMode(mode)}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label[locale]}</TooltipContent>
            </Tooltip>
          ))}

          {/* Separator */}
          <div className="h-6 w-px bg-border mx-1" />

          {/* Undo/Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={!canUndo}
                onClick={undo}
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
          {/* Auto-save indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{locale === "ar" ? "حفظ..." : "Saving..."}</span>
              </>
            ) : isDirty ? (
              <>
                <CloudOff className="h-3 w-3 text-amber-500" />
                <span className="text-amber-600">
                  {locale === "ar" ? "غير محفوظ" : "Unsaved"}
                </span>
              </>
            ) : (
              <>
                <Cloud className="h-3 w-3 text-green-500" />
                <span>{locale === "ar" ? "محفوظ" : "Saved"}</span>
              </>
            )}
          </div>

          {/* Separator */}
          <div className="h-6 w-px bg-border" />

          {/* Bilingual toggle */}
          <div className="flex items-center rounded-md border bg-muted/50 p-0.5">
            <button
              type="button"
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition-colors",
                locale === "en" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setLocale("en")}
            >
              EN
            </button>
            <button
              type="button"
              className={cn(
                "rounded px-2 py-1 text-xs font-medium transition-colors",
                locale === "ar" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setLocale("ar")}
            >
              AR
            </button>
          </div>

          {/* Version history toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showVersionHistory ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={onToggleVersionHistory}
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

          {/* Publish button */}
          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={isPublishing}
            onClick={() => setShowPublishDialog(true)}
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
