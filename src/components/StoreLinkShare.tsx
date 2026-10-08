import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, ExternalLink, ImageDown, Loader2, MessageCircle, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * The merchant's store link, ready to share: copy, send on WhatsApp, open, or
 * scan with a phone. Used by the onboarding reveal and the dashboard, where
 * getting the link out is the one thing that matters on day one.
 */
export default function StoreLinkShare({ url, storeName }: { url: string; storeName?: string }) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [makingStory, setMakingStory] = useState(false);
  const display = url.replace(/^https?:\/\//, "");

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success(isAr ? "اتنسخ الرابط" : "Link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  // A ready-to-post Instagram/WhatsApp story: shared as a file where the
  // browser can, downloaded otherwise.
  const story = async () => {
    setMakingStory(true);
    try {
      const { makeStoryImage } = await import("@/lib/story-image");
      const blob = await makeStoryImage({ url, storeName, isAr });
      const file = new File([blob], "numu-store-story.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: storeName });
      } else {
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(href), 1000);
        toast.success(isAr ? "الصورة اتحمّلت — انشرها ستوري" : "Image saved — post it as a story");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        toast.error(isAr ? "مقدرناش نعمل الصورة، جرّب تاني" : "Couldn't make the image, try again");
      }
    } finally {
      setMakingStory(false);
    }
  };

  const message = isAr
    ? `${storeName ? `${storeName} — ` : ""}اتفرج على متجري: ${url}`
    : `${storeName ? `${storeName} — ` : ""}Check out my store: ${url}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <span dir="ltr" className="flex-1 truncate font-mono text-sm">{display}</span>
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label={isAr ? "افتح المتجر" : "Open store"} className="text-muted-foreground hover:text-foreground">
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {isAr ? "انسخ الرابط" : "Copy link"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" asChild>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            <MessageCircle className="h-3.5 w-3.5" />
            {isAr ? "ابعته على واتساب" : "Send on WhatsApp"}
          </a>
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" aria-expanded={showQr} onClick={() => setShowQr((v) => !v)}>
          <QrCode className="h-3.5 w-3.5" />
          {isAr ? "افتحه على موبايلك" : "Open on your phone"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={makingStory} onClick={story}>
          {makingStory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageDown className="h-3.5 w-3.5" />}
          {isAr ? "صورة ستوري" : "Story image"}
        </Button>
      </div>
      {showQr && (
        <div className="inline-flex flex-col items-center gap-1.5 rounded-lg border bg-white p-3">
          <QRCodeSVG value={url} size={132} />
          <span className="text-[11px] text-muted-foreground">{isAr ? "صوّر الكود بكاميرا الموبايل" : "Scan with your phone camera"}</span>
        </div>
      )}
    </div>
  );
}
