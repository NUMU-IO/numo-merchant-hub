/**
 * ImageCropDialog — crop, resize, and position an image before upload.
 * Uses react-easy-crop for the interactive crop area.
 */

import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, ZoomIn, RotateCw } from "lucide-react";

/**
 * Build an upload-ready File from a crop blob, naming/typing it by the blob's
 * real MIME. The crop preserves transparency (WebP/PNG) for alpha-capable
 * sources, so the result must NOT be relabeled `.jpg` — that would ship a
 * transparent logo/favicon under a JPEG name and content-type.
 */
export function fileFromCropBlob(blob: Blob, basename: string): File {
  const ext =
    blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  return new File([blob], `${basename}.${ext}`, {
    type: blob.type || "image/png",
    lastModified: Date.now(),
  });
}

/** Preset aspect ratio entry shown in the dialog's chooser strip. */
export interface AspectRatioPreset {
  /** Stored aspect ratio. `undefined` means freeform (no constraint). */
  value: number | undefined;
  /** Short label like "16:9", "Free", "1:1". */
  label: string;
  labelAr?: string;
}

interface ImageCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  /** "round" for avatars, "rect" for logos */
  cropShape?: "round" | "rect";
  /** Initial aspect ratio. `undefined` allows freeform cropping. */
  aspect?: number;
  /**
   * Optional preset chooser. When provided, the merchant can toggle between
   * preset aspect ratios in the dialog. Useful for hero images where the
   * merchant — not the platform — decides how the image is framed.
   */
  aspectPresets?: AspectRatioPreset[];
  title?: string;
  loading?: boolean;
  isRTL?: boolean;
}

export function ImageCropDialog({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  cropShape = "round",
  aspect = 1,
  aspectPresets,
  title = "تعديل الصورة",
  loading = false,
  isRTL = false,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [activeAspect, setActiveAspect] = useState<number | undefined>(aspect);

  const onCropChange = useCallback((location: { x: number; y: number }) => {
    setCrop(location);
  }, []);

  const onZoomChange = useCallback((z: number) => {
    setZoom(z);
  }, []);

  const onCropAreaChange = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = useCallback(async () => {
    if (!croppedAreaPixels) return;

    const canvas = document.createElement("canvas");
    const image = new Image();
    image.crossOrigin = "anonymous";

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = reject;
      image.src = imageSrc;
    });

    const { x, y, width, height } = croppedAreaPixels;

    // Output size: max 512px for avatars, 1024px for others
    const maxSize = cropShape === "round" ? 512 : 1024;
    const outputSize = Math.min(width, maxSize);
    const scale = outputSize / width;

    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle rotation
    if (rotation !== 0) {
      const tempCanvas = document.createElement("canvas");
      const rad = (rotation * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));
      tempCanvas.width = image.width * cos + image.height * sin;
      tempCanvas.height = image.width * sin + image.height * cos;
      const tCtx = tempCanvas.getContext("2d")!;
      tCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
      tCtx.rotate(rad);
      tCtx.drawImage(image, -image.width / 2, -image.height / 2);

      ctx.drawImage(
        tempCanvas,
        x, y, width, height,
        0, 0, canvas.width, canvas.height,
      );
    } else {
      ctx.drawImage(
        image,
        x, y, width, height,
        0, 0, canvas.width, canvas.height,
      );
    }

    // Preserve transparency: exporting a transparent PNG/WebP/SVG crop as JPEG
    // flattens the alpha onto BLACK (the "logo shows on a black background"
    // bug). Keep alpha for alpha-capable sources via WebP (small) with a PNG
    // fallback; only opaque JPEG input stays JPEG.
    const srcMime = /^data:(image\/[a-z0-9.+-]+)/i
      .exec(imageSrc)?.[1]
      ?.toLowerCase();
    const keepAlpha = srcMime !== "image/jpeg" && srcMime !== "image/jpg";
    const encode = (type: string) =>
      new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.92));
    let blob = await encode(keepAlpha ? "image/webp" : "image/jpeg");
    if (!blob && keepAlpha) blob = await encode("image/png");
    if (!blob) blob = await encode("image/jpeg");
    if (blob) onCropComplete(blob);
  }, [croppedAreaPixels, imageSrc, rotation, cropShape, onCropComplete]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-sm font-medium">{title}</DialogTitle>
        </DialogHeader>

        {/* Crop area */}
        <div className="relative w-full aspect-square bg-black/90">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={activeAspect}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropAreaChange}
            classes={{
              containerClassName: "!absolute inset-0",
              cropAreaClassName: cropShape === "round"
                ? "!border-2 !border-white/60"
                : "!border-2 !border-white/60",
            }}
          />
        </div>

        {/* Aspect ratio presets — only shown when caller supplies them. The
            merchant picks an aspect and the crop area immediately reframes. */}
        {aspectPresets && aspectPresets.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-5 pt-3">
            {aspectPresets.map((preset) => {
              const isActive =
                (preset.value === undefined && activeAspect === undefined) ||
                (preset.value !== undefined &&
                  activeAspect !== undefined &&
                  Math.abs(preset.value - activeAspect) < 0.001);
              return (
                <button
                  key={`${preset.label}-${preset.value ?? "free"}`}
                  type="button"
                  onClick={() => setActiveAspect(preset.value)}
                  className={
                    "rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors " +
                    (isActive
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-input bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground")
                  }
                >
                  {isRTL ? (preset.labelAr ?? preset.label) : preset.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Controls */}
        <div className="px-5 py-4 space-y-3">
          {/* Zoom */}
          <div className="flex items-center gap-3">
            <ZoomIn className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground w-8 text-left tabular-nums">
              {zoom.toFixed(1)}x
            </span>
          </div>

          {/* Rotation */}
          <div className="flex items-center gap-3">
            <RotateCw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Slider
              value={[rotation]}
              min={0}
              max={360}
              step={1}
              onValueChange={([v]) => setRotation(v)}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground w-8 text-left tabular-nums">
              {rotation}°
            </span>
          </div>
        </div>

        <DialogFooter className="px-5 pb-5 pt-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button size="sm" onClick={handleSave} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
