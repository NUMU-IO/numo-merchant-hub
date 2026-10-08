import { useState } from "react";
import { CheckCircle2, Package, PartyPopper, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";

const STEPS = [
  {
    icon: Package,
    ar: { title: "أوردر جديد", body: "منى من المنصورة طلبت كوبين خزف ب 240 ج.م، الدفع عند الاستلام. هتلاقيه في الأوردرات ويوصلك إشعار." },
    en: { title: "New order", body: "Mona from Mansoura ordered two ceramic mugs for EGP 240, cash on delivery. It shows up in Orders and you get a notification." },
    wa: {
      ar: "أهلاً منى 👋 أوردرك رقم #1024 من متجرك وصل. اضغط «تأكيد» لو كل حاجة تمام.",
      en: "Hi Mona 👋 we got your order #1024. Tap “Confirm” if everything looks right.",
    },
  },
  {
    icon: CheckCircle2,
    ar: { title: "اتأكد", body: "العميلة أكدت على واتساب، أو أنت أكدته من صفحة الأوردر. دلوقتي تجهّزه." },
    en: { title: "Confirmed", body: "The customer confirmed on WhatsApp, or you confirmed it on the order page. Now you prepare it." },
    wa: {
      ar: "تمام يا منى ✅ أوردرك #1024 اتأكد وبنجهّزه دلوقتي.",
      en: "Thanks Mona ✅ order #1024 is confirmed and being prepared.",
    },
  },
  {
    icon: Truck,
    ar: { title: "اتشحن", body: "سلّمته لشركة الشحن وحطيت رقم البوليصة. العميلة بيوصلها رابط تتابع منه." },
    en: { title: "Shipped", body: "You handed it to the courier and added the tracking number. The customer gets a link to follow it." },
    wa: {
      ar: "أوردرك #1024 خرج مع المندوب 🚚 تابعه من هنا: numueg.app/o/…",
      en: "Order #1024 is on its way 🚚 Track it here: numueg.app/o/…",
    },
  },
  {
    icon: PartyPopper,
    ar: { title: "اتسلّم", body: "المندوب سلّم الأوردر وحصّل الفلوس. كده أول بيعة خلصت!" },
    en: { title: "Delivered", body: "The courier delivered it and collected the cash. That's your first sale done!" },
    wa: {
      ar: "وصلك الأوردر يا منى؟ نتمنى يعجبك 🤍",
      en: "Did your order arrive, Mona? We hope you love it 🤍",
    },
  },
] as const;

/**
 * A walk through an order's life with sample data, so a merchant can see what
 * happens before a real customer arrives. Creates nothing anywhere.
 */
export default function DemoOrderWalkthrough({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const copy = isAr ? current.ar : current.en;
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) setStep(0);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isAr ? "أوردر تجريبي" : "Demo order"}</DialogTitle>
          <DialogDescription>
            {isAr ? "تجربة بس — مفيش أوردر حقيقي اتعمل ومفيش رسايل اتبعتت." : "Just a demo — no real order is created and no messages are sent."}
          </DialogDescription>
        </DialogHeader>

        <ol className="flex gap-1.5" aria-label={isAr ? "مراحل الأوردر" : "Order steps"}>
          {STEPS.map((s, i) => (
            <li key={s.en.title} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} aria-current={i === step ? "step" : undefined} />
          ))}
        </ol>

        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold">{copy.title}</p>
            <p className="text-sm text-muted-foreground">{copy.body}</p>
          </div>
        </div>

        <div className="rounded-xl bg-[#E5DDD5] p-3" aria-label={isAr ? "رسالة واتساب للعميل" : "WhatsApp message to the customer"}>
          <p className="mb-1 text-[11px] text-black/50">{isAr ? "اللي بيوصل العميلة على واتساب" : "What the customer gets on WhatsApp"}</p>
          <div className="ms-auto max-w-[85%] rounded-lg rounded-se-none bg-[#DCF8C6] px-3 py-2 text-sm text-black shadow-sm">
            {isAr ? current.wa.ar : current.wa.en}
          </div>
        </div>

        <div className="flex justify-between gap-2">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            {isAr ? "رجوع" : "Back"}
          </Button>
          {last ? (
            <Button onClick={() => close(false)}>{isAr ? "تمام، فهمت" : "Got it"}</Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>{isAr ? "الخطوة الجاية" : "Next step"}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
