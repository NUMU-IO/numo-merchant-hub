import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Facebook, Instagram, Loader2, MessageCircle, MessagesSquare, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCustomerSocialProfiles,
  setCustomerAvatarFromThread,
  type SocialProfile,
} from "@/services/customerApi";
import { cn } from "@/lib/utils";

export const CHANNEL_META = {
  facebook: { icon: Facebook, label: "Messenger", labelAr: "ماسنجر", chip: "bg-[#1877F2] text-white" },
  instagram: { icon: Instagram, label: "Instagram", labelAr: "إنستجرام", chip: "bg-gradient-to-tr from-[#FEDA75] via-[#D62976] to-[#4F5BD5] text-white" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", labelAr: "واتساب", chip: "bg-[#25D366] text-white" },
} as const;

export function socialProfilesKey(storeId: string | undefined, customerId: string | undefined) {
  return ["customer-social-profiles", storeId, customerId] as const;
}

export function useCustomerSocialProfiles(storeId?: string, customerId?: string) {
  return useQuery({
    queryKey: socialProfilesKey(storeId, customerId),
    queryFn: () => getCustomerSocialProfiles(storeId!, customerId!),
    enabled: !!storeId && !!customerId,
    staleTime: 60_000,
  });
}

/** Avatar + channel badge, shared row visual (mirrors the Inbox avatar). */
export function ChannelAvatar({ profile, size = "md" }: { profile: SocialProfile; size?: "md" | "sm" }) {
  const meta = CHANNEL_META[profile.channel];
  const Icon = meta.icon;
  const dim = size === "md" ? "h-10 w-10" : "h-8 w-8";
  return (
    <div className="relative shrink-0">
      <Avatar className={dim}>
        {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt="" />}
        <AvatarFallback className="text-xs font-bold">
          {(profile.name || "؟").slice(0, 2)}
        </AvatarFallback>
      </Avatar>
      <span className={cn("absolute -bottom-0.5 -end-0.5 grid h-4.5 w-4.5 h-[18px] w-[18px] place-items-center rounded-full ring-2 ring-background", meta.chip)}>
        <Icon className="h-2.5 w-2.5" />
      </span>
    </div>
  );
}

/**
 * "Connected channels" card on the customer profile: the conversations a
 * merchant explicitly linked to this customer in the Inbox — open the
 * chat, or adopt the counterpart's profile picture as the customer photo.
 */
export function ConnectedChannelsCard({
  storeId,
  customerId,
  isAr,
}: {
  storeId: string;
  customerId: string;
  isAr: boolean;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const profilesQ = useCustomerSocialProfiles(storeId, customerId);

  const adopt = useMutation({
    mutationFn: (threadId: string) => setCustomerAvatarFromThread(storeId, customerId, threadId),
    onSuccess: () => {
      toast.success(isAr ? "تم تحديث صورة العميل" : "Customer photo updated");
      qc.invalidateQueries({ queryKey: ["customer", storeId, customerId] });
      qc.invalidateQueries({ queryKey: ["customers", storeId] });
    },
    onError: () => toast.error(isAr ? "تعذر تحديث الصورة" : "Couldn't update the photo"),
  });

  const profiles = profilesQ.data ?? [];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
          <MessagesSquare className="h-3.5 w-3.5 text-muted-foreground" />
          {isAr ? "القنوات المتصلة" : "Connected channels"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {profilesQ.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-11 w-full rounded-lg" />
          </div>
        ) : profiles.length === 0 ? (
          <p className="py-3 text-[12px] leading-relaxed text-muted-foreground">
            {isAr
              ? "مفيش محادثات مربوطة. افتح المحادثة في الإنبوكس واضغط «ربط عميل» عشان تظهر هنا."
              : "No linked conversations. Open the chat in the Inbox and use “Link customer” to connect it here."}
          </p>
        ) : (
          <ul className="space-y-1">
            {profiles.map((p) => {
              const meta = CHANNEL_META[p.channel];
              return (
                <li key={`${p.kind}-${p.id}`} className="group flex items-center gap-2.5 rounded-lg p-1.5 -mx-1.5 transition-colors hover:bg-muted/50">
                  <button type="button" onClick={() => navigate(p.inbox_path)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
                    <ChannelAvatar profile={p} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">
                        {p.name || p.phone || (isAr ? meta.labelAr : meta.label)}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {isAr ? meta.labelAr : meta.label}
                        {p.last_message_preview ? ` · ${p.last_message_preview}` : ""}
                      </span>
                    </span>
                  </button>
                  {p.avatar_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 gap-1 px-2 text-[11px] opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                      disabled={adopt.isPending}
                      onClick={() => adopt.mutate(p.id)}
                      title={isAr ? "استخدمها كصورة للعميل" : "Use as customer photo"}
                    >
                      {adopt.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserRoundCheck className="h-3 w-3" />}
                      {isAr ? "كصورة" : "Use photo"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default ConnectedChannelsCard;
