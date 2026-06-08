/**
 * FocalPointEditor — non-destructive "move the image behind a fixed viewport"
 * editor (Shopify/Canva-class). The merchant drags to pan, zooms, and rotates;
 * we only ever record METADATA (focal/zoom/rotation) — the uploaded asset is
 * never cropped or re-encoded.
 *
 * Render parity: the preview viewport uses the SAME `applyImageTransform` CSS
 * the storefront applies, at the SAME aspect ratio as the real container, so
 * "what you see is exactly what ships" (the project's hard requirement — no
 * crop/zoom drift between editor and storefront).
 *
 * Why custom (not react-easy-crop, which IS installed): react-easy-crop is
 * crop-box / translate-scale oriented; reproducing its result responsively on
 * the storefront would require matching, drift-prone math. Rendering the editor
 * with the storefront's own CSS guarantees zero drift and keeps one render model.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw, RotateCw, Crosshair, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EditorLocale } from "../../types";
import {
  applyImageTransform,
  isIdentityTransform,
  DEFAULT_TRANSFORM,
  MIN_ZOOM,
  MAX_ZOOM,
  type ImageTransform,
} from "./imageTransform";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  alt: string;
  /** Aspect ratio of the real storefront container, e.g. "4/5", "16/9". */
  aspectRatio: string;
  value: ImageTransform | undefined;
  /** Called on Apply. `undefined` = no transform (identity) → caller clears it. */
  onApply: (transform: ImageTransform | undefined) => void;
  locale: EditorLocale;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const KEY_NUDGE = 0.02; // focal nudge per arrow press
const KEY_ZOOM = 0.1;

export function FocalPointEditor({
  open,
  onOpenChange,
  url,
  alt,
  aspectRatio,
  value,
  onApply,
  locale,
}: Props) {
  const isAr = locale === "ar";
  const [t, setT] = useState<ImageTransform>(value ?? DEFAULT_TRANSFORM);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  // Sync local state from the incoming value each time the dialog opens.
  useEffect(() => {
    if (open) setT(value ?? DEFAULT_TRANSFORM);
  }, [open, value]);

  const focal = t.focal ?? { x: 0.5, y: 0.5 };
  const zoom = t.zoom ?? 1;
  const rotation = t.rotation ?? 0;

  const patch = useCallback((p: Partial<ImageTransform>) => {
    setT((prev) => ({ ...prev, v: 1, ...p }));
  }, []);

  const setFocal = useCallback(
    (x: number, y: number) =>
      patch({ focal: { x: clamp(x, 0, 1), y: clamp(y, 0, 1) } }),
    [patch],
  );

  // ── Drag-to-pan: dragging the image right reveals its left edge, so the
  //    focal x DECREASES; divide by zoom so a given drag pans less when zoomed.
  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    // RTL mirrors the horizontal axis so "drag right" feels right both ways.
    const sx = isAr ? 1 : -1;
    setFocal(focal.x + (sx * dx) / rect.width / zoom, focal.y - dy / rect.height / zoom);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be released */
    }
    dragRef.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    patch({ zoom: clamp(zoom + (e.deltaY < 0 ? 0.08 : -0.08), MIN_ZOOM, MAX_ZOOM) });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const sx = isAr ? -1 : 1;
    switch (e.key) {
      case "ArrowLeft": e.preventDefault(); setFocal(focal.x - sx * KEY_NUDGE, focal.y); break;
      case "ArrowRight": e.preventDefault(); setFocal(focal.x + sx * KEY_NUDGE, focal.y); break;
      case "ArrowUp": e.preventDefault(); setFocal(focal.x, focal.y - KEY_NUDGE); break;
      case "ArrowDown": e.preventDefault(); setFocal(focal.x, focal.y + KEY_NUDGE); break;
      case "+": case "=": e.preventDefault(); patch({ zoom: clamp(zoom + KEY_ZOOM, MIN_ZOOM, MAX_ZOOM) }); break;
      case "-": case "_": e.preventDefault(); patch({ zoom: clamp(zoom - KEY_ZOOM, MIN_ZOOM, MAX_ZOOM) }); break;
      default: break;
    }
  };

  const apply = () => {
    onApply(isIdentityTransform(t) ? undefined : { ...t, v: 1 });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{isAr ? "ضبط الصورة" : "Adjust image"}</DialogTitle>
        </DialogHeader>

        {/* Exact-container preview: same aspect ratio + same CSS as storefront */}
        <div
          ref={viewportRef}
          role="application"
          tabIndex={0}
          aria-label={isAr ? "اسحب لتحريك الصورة" : "Drag to reposition the image"}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          className="relative w-full cursor-move touch-none overflow-hidden rounded-md border bg-muted outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-primary"
          style={{ aspectRatio: aspectRatio.replace("/", " / ") }}
        >
          {url ? (
            <img
              src={url}
              alt={alt}
              draggable={false}
              className="pointer-events-none h-full w-full select-none"
              style={applyImageTransform(t, "cover")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              {isAr ? "لا توجد صورة" : "No image"}
            </div>
          )}
          {/* Focal crosshair */}
          <div
            aria-hidden
            className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
            style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
          />
        </div>

        {/* Zoom */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{isAr ? "تكبير" : "Zoom"}</span>
            <span className="tabular-nums">{zoom.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => patch({ zoom: clamp(Number(e.target.value), MIN_ZOOM, MAX_ZOOM) })}
            className="w-full accent-primary"
            aria-label={isAr ? "تكبير" : "Zoom"}
          />
        </div>

        {/* Rotate + reset */}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5"
            onClick={() => patch({ rotation: (rotation - 90 + 360) % 360 })}>
            <RotateCcw className="h-3.5 w-3.5" /> {isAr ? "يسار" : "Left"}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5"
            onClick={() => patch({ rotation: (rotation + 90) % 360 })}>
            <RotateCw className="h-3.5 w-3.5" /> {isAr ? "يمين" : "Right"}
          </Button>
          <Button type="button" variant="outline" size="sm" className="gap-1.5"
            onClick={() => setFocal(0.5, 0.5)}>
            <Crosshair className="h-3.5 w-3.5" /> {isAr ? "توسيط" : "Center"}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="ms-auto gap-1.5"
            onClick={() => setT(DEFAULT_TRANSFORM)}>
            <Maximize2 className="h-3.5 w-3.5" /> {isAr ? "إعادة تعيين" : "Reset"}
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="button" onClick={apply}>
            {isAr ? "تطبيق" : "Apply"}
          </Button>
        </DialogFooter>

        <p className={cn("text-center text-[10px] text-muted-foreground")}>
          {isAr
            ? "اسحب الصورة · عجلة الماوس للتكبير · الأسهم للضبط الدقيق"
            : "Drag to reposition · scroll to zoom · arrow keys to fine-tune"}
        </p>
      </DialogContent>
    </Dialog>
  );
}
