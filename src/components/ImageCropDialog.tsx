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

interface ImageCropDialogProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  /** "round" for avatars, "rect" for logos */
  cropShape?: "round" | "rect";
  /** Aspect ratio (1 = square, 16/9 = wide) */
  aspect?: number;
  title?: string;
  loading?: boolean;
}

export function ImageCropDialog({
  open,
  onClose,
  imageSrc,
  onCropComplete,
  cropShape = "round",
  aspect = 1,
  title = "تعديل الصورة",
  loading = false,
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

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

    canvas.toBlob(
      (blob) => {
        if (blob) onCropComplete(blob);
      },
      "image/jpeg",
      0.9,
    );
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
            aspect={aspect}
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
