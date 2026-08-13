/**
 * Push notification settings.
 *
 * Also serves as the always-available second chance: the dashboard pre-prompt
 * is deliberately shown once and can be dismissed forever, so this is where a
 * merchant who said "not now" — or who blocked it and changed their mind —
 * comes back.
 */
import { useState } from "react";
import { Bell, BellOff, Smartphone, Loader2, Volume2, VolumeX } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  isOrderSoundEnabled,
  setOrderSoundEnabled,
  useNewOrderSound,
} from "@/hooks/useNewOrderSound";

export function NotificationSettings() {
  const { isRTL } = useLanguage();
  const isAr = isRTL;
  const { supported, subscribed, busy, blocked, needsInstallFirst, subscribe, unsubscribe } =
    usePushNotifications();
  const [soundOn, setSoundOn] = useState(isOrderSoundEnabled);
  const previewSound = useNewOrderSound();

  // NOTE: this card is NOT hidden when push is unsupported, because the sound
  // toggle below works everywhere — it needs no permission and no service
  // worker. Only the push section self-hides.

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-extrabold">
          <Bell className="h-4 w-4 text-saffron" />
          {isAr ? "إشعارات الموبايل" : "Push notifications"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Push section only. Hidden where the browser can't do Web Push at
            all — a permanently-dead toggle reads as a broken feature — but the
            sound toggle further down still renders, because it needs no
            permission, no service worker and works in every browser. */}
        {!supported && !needsInstallFirst ? null : needsInstallFirst ? (
          // iOS only allows Web Push from a Home-Screen app. Say that plainly
          // instead of showing a toggle that cannot work.
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3.5">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {isAr
                ? "على الآيفون، لازم تضيف نومو للشاشة الرئيسية الأول عشان الإشعارات تشتغل."
                : "On iPhone, add NUMU to your Home Screen first — iOS only allows notifications for installed apps."}
            </p>
          </div>
        ) : blocked ? (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3.5">
            <BellOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {isAr
                ? "الإشعارات متمنوعة من إعدادات المتصفح. افتح إعدادات الموقع وفعّلها، وارجع هنا."
                : "Notifications are blocked in your browser. Enable them in site settings, then come back."}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[14px] font-bold">
                {isAr ? "طلبات جديدة" : "New orders"}
              </p>
              <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
                {isAr
                  ? "يوصلك إشعار على الموبايل أول ما يجيلك طلب — من غير ما تفضل فاتح الصفحة."
                  : "Get a notification the moment an order arrives — without keeping this page open."}
              </p>
            </div>
            {busy ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={subscribed}
                onCheckedChange={(next) => {
                  // requestPermission() must run inside the gesture stack.
                  if (next) void subscribe();
                  else void unsubscribe();
                }}
                aria-label={isAr ? "تفعيل إشعارات الطلبات" : "Enable order notifications"}
              />
            )}
          </div>
        )}

        {/* Sound is independent of push on purpose: it fires when the hub is
            OPEN, which is the case push notifications don't cover. A merchant
            with the dashboard on a counter screen isn't watching it. */}
        <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[14px] font-bold">
              {soundOn ? (
                <Volume2 className="h-4 w-4 text-saffron" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
              {isAr ? "صوت الطلب الجديد" : "New-order sound"}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
              {isAr
                ? "نفس نغمة تطبيق الموبايل، بتشتغل وانت فاتح لوحة التحكم."
                : "The same chime as the mobile app, played while the dashboard is open."}
            </p>
          </div>
          <Switch
            checked={soundOn}
            onCheckedChange={(next) => {
              setOrderSoundEnabled(next);
              setSoundOn(next);
              // Play it on enable so the merchant hears what they just chose —
              // and the click doubles as the gesture that unlocks autoplay.
              if (next) previewSound();
            }}
            aria-label={isAr ? "تفعيل صوت الطلب الجديد" : "Enable new-order sound"}
          />
        </div>

        <p className="border-t border-border/60 pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
          {isAr
            ? "الإشعار بيعرض رقم الطلب والمبلغ بس — من غير أي بيانات عن العميل، عشان بيظهر على شاشة القفل."
            : "Notifications show the order number and amount only — never customer details, since they appear on your lock screen."}
        </p>
      </CardContent>
    </Card>
  );
}
