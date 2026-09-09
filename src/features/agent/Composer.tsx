/**
 * Composer — the agent's message box: photo attachments + text + send.
 *
 * Extracted from AgentPanel so the slide-over and the full-page Assistant
 * compose a turn the same way. Three layouts of the same parts:
 *
 *   bar    — compact row, used inside the slide-over.
 *   hero   — single line, used on the launcher: clean left edge, controls
 *            gathered on the right.
 *   panel  — taller box with the controls on their own row underneath, used
 *            at the foot of a thread where the follow-up is usually longer.
 *
 * Photos are uploaded on pick, so the agent is only ever handed URLs — it
 * never sees bytes.
 */
import { ArrowRight, ImagePlus, Loader2, Send, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { showError } from "@/lib/show-error";
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
  variant?: "bar" | "hero" | "panel";
  placeholder?: string;
  /** Quiet affordance beside the send control, e.g. "Enter to send". */
  hint?: string;
  autoFocus?: boolean;
  onSend: (text: string, attachments: ChatAttachment[]) => void;
}) {
  const { t } = useTranslation();
  const { language, isRTL } = useLanguage();
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
    } catch (err) {
      // A swallowed failure here reads as "the attach button does nothing":
      // the picker opens, a file is chosen, and no thumbnail ever appears.
      // Say what went wrong instead.
      showError(err, language, "رفع الصورة", "upload the photo");
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

  const isBar = variant === "bar";
  const isPanel = variant === "panel";

  const attachButton = (
    <Button
      size="icon"
      variant="ghost"
      className={isBar ? "" : "h-8 w-8 shrink-0 text-muted-foreground"}
      aria-label={t("agent.attachImage")}
      disabled={disabled || uploading || !storeId || pending.length >= MAX_ATTACHMENTS}
      onClick={() => fileRef.current?.click()}
    >
      {uploading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ImagePlus className="h-4 w-4" />
      )}
    </Button>
  );

  const sendButton = (
    <Button
      size="icon"
      variant={isBar ? "default" : "ghost"}
      className={
        isBar
          ? ""
          : `h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground${
              isPanel ? " border" : ""
            }`
      }
      onClick={handleSend}
      disabled={disabled || !input.trim()}
      aria-label={t("agent.send")}
    >
      {disabled ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isBar ? (
        <Send className="h-4 w-4" />
      ) : (
        <ArrowRight className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
      )}
    </Button>
  );

  const hintLabel = hint && !input.trim() && (
    <span className="hidden shrink-0 px-1 text-[0.6875rem] text-muted-foreground sm:block">
      {hint}
    </span>
  );

  const textarea = (
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
      rows={isPanel ? 2 : 1}
      autoFocus={autoFocus}
      className={
        isBar
          ? "max-h-32 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          : isPanel
            ? "max-h-[300px] w-full resize-none bg-transparent px-1 pt-1 text-sm leading-6 placeholder:text-muted-foreground focus:outline-none"
            : "max-h-[300px] flex-1 resize-none bg-transparent px-1 py-1 text-sm leading-6 placeholder:text-muted-foreground focus:outline-none"
      }
    />
  );

  const thumbnails = pending.length > 0 && (
    <div className="mb-2 flex flex-wrap gap-2 px-1">
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
  );

  const fileInput = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      multiple
      hidden
      onChange={(e) => void handlePick(e.target.files)}
    />
  );

  // Taller box: the message gets the top, the controls get a row of their own.
  if (isPanel) {
    return (
      <div className="rounded-xl border bg-card p-2 shadow-sm focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30">
        {thumbnails}
        {fileInput}
        {textarea}
        <div className="mt-2 flex items-center gap-1">
          {attachButton}
          <span className="flex-1" />
          {hintLabel}
          {sendButton}
        </div>
      </div>
    );
  }

  return (
    <div className={isBar ? "border-t p-3" : ""}>
      {thumbnails}
      <div
        className={
          isBar
            ? "flex items-end gap-2"
            : "flex min-h-[40px] w-full items-center gap-1 rounded-lg border bg-card py-1 pe-1 ps-2.5 focus-within:ring-1 focus-within:ring-ring"
        }
      >
        {fileInput}
        {/* On the hero the left edge stays clean — every control sits in the
            right cluster, so the placeholder starts where the eye lands. */}
        {isBar && attachButton}
        {textarea}
        {hintLabel}
        {!isBar && attachButton}
        {sendButton}
      </div>
    </div>
  );
}

export default Composer;
