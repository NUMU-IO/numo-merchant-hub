/**
 * Camera barcode scanner.
 *
 * Uses the native `BarcodeDetector` where available (Chrome/Android — the
 * majority of NUMU merchants) and simply reports unsupported elsewhere. A
 * WASM polyfill would be the alternative, but it is a multi-hundred-KB
 * download and this is a convenience feature, not a required path: manual
 * entry always works and is the accessible route.
 *
 * ─── THE CAMERA MUST BE RELEASED ─────────────────────────────────────────────
 * A leaked MediaStream keeps the camera light on and drains the battery. On a
 * merchant's phone that reads as spyware, and it is the fastest way to get an
 * app deleted. The stream is stopped on close, on unmount, and when the tab is
 * hidden.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, X, Keyboard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

export function isBarcodeScanSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "BarcodeDetector" in window &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

interface BarcodeScannerProps {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export function BarcodeScanner({ open, onClose, onDetected }: BarcodeScannerProps) {
  const { isRTL } = useLanguage();
  const isAr = isRTL;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [manual, setManual] = useState("");
  const [manualMode, setManualMode] = useState(!isBarcodeScanSupported());

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open || manualMode) return;
    let cancelled = false;

    void (async () => {
      setStarting(true);
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          // Rear camera — a merchant scans a product in front of them.
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor })
          .BarcodeDetector;
        const detector = new Ctor({
          formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"],
        });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const found = await detector.detect(videoRef.current);
            const code = found[0]?.rawValue?.trim();
            if (code) {
              stop();
              onDetected(code);
              return;
            }
          } catch {
            /* a frame failed to decode — normal, keep going */
          }
          rafRef.current = requestAnimationFrame(() => void tick());
        };
        rafRef.current = requestAnimationFrame(() => void tick());
      } catch {
        // Permission denied, no camera, or insecure context. Manual entry is
        // always the fallback — never a dead end.
        setError(
          isAr
            ? "مش قادرين نفتح الكاميرا. اكتب الكود بإيدك."
            : "Couldn't open the camera. Enter the code manually.",
        );
        setManualMode(true);
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, manualMode, onDetected, stop, isAr]);

  // Backgrounding the tab must release the camera too — otherwise the light
  // stays on while the merchant is in another app.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stop]);

  useEffect(() => {
    if (!open) stop();
  }, [open, stop]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black">
      <div className="safe-top flex items-center justify-between p-3">
        <span className="text-[15px] font-bold text-white">
          {isAr ? "امسح الباركود" : "Scan barcode"}
        </span>
        <button
          type="button"
          onClick={() => {
            stop();
            onClose();
          }}
          aria-label={isAr ? "إغلاق" : "Close"}
          className="grid h-11 w-11 place-items-center rounded-xl text-white/80 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {manualMode ? (
        <div className="flex flex-1 flex-col justify-center gap-4 p-6">
          {error && <p className="text-center text-[13px] text-white/70">{error}</p>}
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            inputMode="numeric"
            autoFocus
            placeholder={isAr ? "اكتب الباركود" : "Enter barcode"}
            className="h-14 bg-white text-center text-[16px]"
          />
          <Button
            type="button"
            disabled={!manual.trim()}
            onClick={() => onDetected(manual.trim())}
            className="h-12 rounded-xl font-bold"
          >
            {isAr ? "بحث" : "Search"}
          </Button>
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          {/* Reticle */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-32 w-[78%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
          </div>
          {starting && (
            <div className="absolute inset-0 grid place-items-center">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>
      )}

      {!manualMode && (
        <div className="safe-bottom p-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              stop();
              setManualMode(true);
            }}
            className="h-12 w-full rounded-xl font-bold"
          >
            <Keyboard className="me-2 h-4 w-4" />
            {isAr ? "اكتبه بإيدك" : "Enter manually"}
          </Button>
        </div>
      )}
    </div>
  );
}

export { Camera as BarcodeScanIcon };
