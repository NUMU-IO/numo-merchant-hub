import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { sendOrderPaymentLink } from "@/services/orderApi";
import { Send } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChannelAvatar,
  CHANNEL_META,
  useCustomerSocialProfiles,
} from "@/components/customers/ConnectedChannelsCard";
import type { SocialProfile } from "@/services/customerApi";
import { cn } from "@/lib/utils";

/**
 * "Send a payment request into the customer's chat" block. Renders only
 * when the customer has linked conversations (Inbox → Link customer);
 * FB/IG/WA all route through the omnichannel thread send. WhatsApp-only
 * inbox rows can't receive an API send here, so they're not offered.
 */
export function SendPaymentLinkPicker({
  storeId,
  customerId,
  isAr,
  enabled,
  onChange,
}: {
  storeId: string;
  customerId: string | undefined;
  isAr: boolean;
  /** Externally forced off (e.g. COD selected). */
  enabled: boolean;
  onChange: (threadId: string | null) => void;
}) {
  const profilesQ = useCustomerSocialProfiles(storeId, customerId ?? undefined);
  // Only omnichannel threads are sendable through the payment-link API.
  const sendable = (profilesQ.data ?? []).filter((p): p is SocialProfile => p.kind === "thread");
  const [checked, setChecked] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  // Default to the most recent conversation once loaded.
  useEffect(() => {
    if (sendable.length && !threadId) setThreadId(sendable[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendable.length]);

  // Report upward only when active & allowed.
  useEffect(() => {
    onChange(enabled && checked && threadId ? threadId : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, checked, threadId]);

  if (!customerId || sendable.length === 0) return null;

  return (
    <div className={cn("rounded-lg border border-border p-3 transition-opacity", !enabled && "pointer-events-none opacity-50")}>
      <label className="flex items-start gap-2.5">
        <Checkbox checked={checked} onCheckedChange={(v) => setChecked(Boolean(v))} className="mt-0.5" />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Send className="h-3.5 w-3.5 text-muted-foreground" />
            {isAr ? "ابعت طلب الدفع في شات العميل" : "Send the payment request in the customer's chat"}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-muted-foreground">
            {isAr
              ? "رسالة فيها ملخص الطلب ولينك دفع آمن — بتتبعت فعليًا على القناة اللي تختارها."
              : "A message with the order summary and a secure pay link — actually sent on the channel you pick."}
          </span>
        </span>
      </label>

      {checked && (
        <div className="mt-2.5 flex flex-wrap gap-2 ps-7">
          {sendable.map((p) => {
            const meta = CHANNEL_META[p.channel];
            const active = threadId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setThreadId(p.id)}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-1 pe-3 ps-1 text-[12px] font-semibold transition-colors",
                  active ? "border-navy bg-navy/[0.05] dark:border-saffron" : "border-border hover:bg-muted/50",
                )}
                aria-pressed={active}
              >
                <ChannelAvatar profile={p} size="sm" />
                <span className="max-w-[140px] truncate">{p.name || (isAr ? meta.labelAr : meta.label)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * "Send payment link" button + dialog for the order page — resend path
 * when the order is unpaid and the customer has linked conversations.
 */
export function SendPaymentLinkButton({
  storeId,
  orderId,
  customerId,
  isAr,
}: {
  storeId: string;
  orderId: string;
  customerId: string;
  isAr: boolean;
}) {
  const profilesQ = useCustomerSocialProfiles(storeId, customerId);
  const sendable = (profilesQ.data ?? []).filter((p) => p.kind === "thread");
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    if (sendable.length && !threadId) setThreadId(sendable[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendable.length]);

  const send = useMutation({
    mutationFn: () => sendOrderPaymentLink(storeId, orderId, threadId!),
    onSuccess: (res) => {
      toast.success(
        isAr
          ? `تم إرسال لينك الدفع على ${res.channel === "instagram" ? "إنستجرام" : res.channel === "facebook" ? "ماسنجر" : "واتساب"}`
          : `Payment link sent on ${res.channel === "instagram" ? "Instagram" : res.channel === "facebook" ? "Messenger" : "WhatsApp"}`,
      );
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : (isAr ? "تعذر الإرسال" : "Couldn't send")),
  });

  if (sendable.length === 0) return null;

  return (
    <>
      <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => setOpen(true)}>
        <Send className="h-3.5 w-3.5" />
        {isAr ? "ابعت لينك الدفع" : "Send payment link"}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !send.isPending && setOpen(o)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>{isAr ? "ابعت لينك الدفع" : "Send payment link"}</DialogTitle>
          </DialogHeader>
          <p className="text-[12.5px] text-muted-foreground">
            {isAr
              ? "رسالة فيها ملخص الطلب ولينك دفع آمن هتتبعت في المحادثة اللي تختارها."
              : "A message with the order summary and a secure pay link will be sent in the conversation you pick."}
          </p>
          <div className="space-y-1.5">
            {sendable.map((p) => {
              const meta = CHANNEL_META[p.channel];
              const active = threadId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setThreadId(p.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-start transition-colors",
                    active ? "border-navy bg-navy/[0.05] dark:border-saffron" : "border-border hover:bg-muted/40",
                  )}
                  aria-pressed={active}
                >
                  <ChannelAvatar profile={p} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{p.name || (isAr ? meta.labelAr : meta.label)}</span>
                    <span className="block text-[11px] text-muted-foreground">{isAr ? meta.labelAr : meta.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={send.isPending}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button size="sm" className="gap-1.5" disabled={!threadId || send.isPending} onClick={() => send.mutate()}>
              {send.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {isAr ? "إرسال" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SendPaymentLinkPicker;
