/**
 * Composer — the agent's message box: photo attachments + text + send.
 *
 * Extracted from AgentPanel so the slide-over and the full-page Assistant
 * compose a turn the same way. `variant="hero"` is the large centred input the
 * Assistant page opens on; `variant="bar"` is the compact bottom bar used
 * inside a thread and in the slide-over.
 *
 * Photos are uploaded on pick, so the agent is only ever handed URLs — it
 * never sees bytes.
 */
import { ArrowRight, ImagePlus, Loader2, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { uploadStoreAsset } from "@/services/storeApi";

import type { ChatAttachment } from "./api";

const MAX_ATTACHMENTS = 4;

export function Composer({
  storeId,
  disabled = false,
  variant = "bar",
  placeholder,
  hint,
  autoFocus = false,
  onSend,
}: {
  storeId: string | null;
  disabled?: boolean;
  variant?: "bar" | "hero";
  placeholder?: string;
  /** Quiet right-aligned affordance on the hero input, e.g. "Enter to send". */
  hint?: string;
  autoFocus?: boolean;
  onSend: (text: string, attachments: ChatAttachment[]) => void;
}) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [input, setInput] = useState("");
  const [pending, setPending] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePick = async (files: FileList | null) => {
    if (!files?.length || !storeId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, MAX_ATTACHMENTS - pending.length)) {
        // uploadStoreAsset already compresses phone photos under the cap.
        const res = await uploadStoreAsset(storeId, file, "product_image");
        setPending((p) => [...p, { type: "image", url: res.url }]);
      }
    } catch {
      // Non-fatal: the merchant can retry or just send the message as text.
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    onSend(input, pending);
    setInput("");
    setPending([]);
  };

  const isHero = variant === "hero";

  return (
    <div className={isHero ? "" : "border-t p-3"}>
      {pending.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {pending.map((a) => (
            <div key={a.url} className="relative">
              <img src={a.url} alt="" className="h-14 w-14 rounded border object-cover" />
              <button
                type="button"
                aria-label={t("agent.removeAttachment")}
                onClick={() => setPending((p) => p.filter((x) => x.url !== a.url))}
                className="absolute -end-1.5 -top-1.5 rounded-full bg-foreground p-0.5 text-background"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className={
          isHero
            ? "flex min-h-[40px] w-full items-center gap-1 rounded-lg border bg-card py-1 pe-1 ps-2.5 focus-within:ring-1 focus-within:ring-ring"
            : "flex items-end gap-2"
        }
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void handlePick(e.target.files)}
        />
        {/* On the hero the left edge stays clean — every control sits in the
            right cluster, so the placeholder starts where the eye lands. */}
        {!isHero && (
          <Button
            size="icon"
            variant="ghost"
            aria-label={t("agent.attachImage")}
            disabled={disabled || uploading || pending.length >= MAX_ATTACHMENTS}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </Button>
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={placeholder ?? t("agent.placeholder")}
          dir={isRTL ? "rtl" : "ltr"}
          rows={1}
          autoFocus={autoFocus}
          className={
            isHero
              ? "max-h-[300px] flex-1 resize-none bg-transparent px-1 py-1 text-sm leading-6 placeholder:text-muted-foreground focus:outline-none"
              : "max-h-32 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          }
        />
        {isHero && hint && !input.trim() && (
          <span className="hidden shrink-0 px-1 text-[0.6875rem] text-muted-foreground sm:block">
            {hint}
          </span>
        )}
        {isHero && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-muted-foreground"
            aria-label={t("agent.attachImage")}
            disabled={disabled || uploading || pending.length >= MAX_ATTACHMENTS}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
          </Button>
        )}
        <Button
          size="icon"
          variant={isHero ? "ghost" : "default"}
          className={isHero ? "h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" : ""}
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          aria-label={t("agent.send")}
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isHero ? (
            <ArrowRight className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export default Composer;
