/**
 * Dashboard promo swiper slides. The creatives are pre-rendered (AR-EG
 * copy + CTA baked in) and live in /public/swiper as 1600×797 WebP
 * (~70 KB each) with a 32 px blurred placeholder next to them.
 *
 * Each slide is ONE link — the baked CTA sits inside the click target.
 * Dismissals are per-slide, per-browser (see PromoSwiper).
 */

export interface PromoSlide {
  id: string;
  /** Arabic creative (default). */
  image: string;
  placeholder: string;
  /** English creative — falls back to the Arabic one when absent. */
  image_en?: string;
  placeholder_en?: string;
  /** Internal route, or an absolute URL (opens in a new tab). */
  href: string;
  /** Screen-reader text — the creative's headline. */
  alt: { en: string; ar: string };
}

const supportWhatsApp = (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined)?.replace(/[^\d]/g, "");
const reviewHref = supportWhatsApp
  ? `https://wa.me/${supportWhatsApp}?text=${encodeURIComponent("عايز أطلب مراجعة نمو لمتجري")}`
  : "mailto:support@numueg.app?subject=" + encodeURIComponent("طلب مراجعة نمو");

/** Pick the creative for the active language. */
export function slideImage(slide: PromoSlide, lang: string) {
  const en = lang !== "ar" && slide.image_en;
  return en
    ? { src: slide.image_en!, placeholder: slide.placeholder_en ?? slide.placeholder }
    : { src: slide.image, placeholder: slide.placeholder };
}

export const PROMO_SLIDES: PromoSlide[] = [
  {
    id: "whatsapp",
    image: "/swiper/whatsapp.webp",
    placeholder: "/swiper/whatsapp-ph.webp",
    image_en: "/swiper/whatsapp-en.webp",
    placeholder_en: "/swiper/whatsapp-en-ph.webp",
    href: "/whatsapp",
    alt: { en: "Turn chats into orders — discover WhatsApp", ar: "حوّل الشات لطلبات — اكتشف واتساب" },
  },
  {
    id: "ai-tools",
    image: "/swiper/ai-tools.webp",
    placeholder: "/swiper/ai-tools-ph.webp",
    image_en: "/swiper/ai-tools-en.webp",
    placeholder_en: "/swiper/ai-tools-en-ph.webp",
    href: "/settings/mcp",
    alt: { en: "Not just one smart tool — discover the AI tools", ar: "مش أداة ذكية واحدة — اكتشف أدوات الذكاء الاصطناعي" },
  },
  {
    id: "growth-review",
    image: "/swiper/growth-review.webp",
    placeholder: "/swiper/growth-review-ph.webp",
    image_en: "/swiper/growth-review-en.webp",
    placeholder_en: "/swiper/growth-review-en-ph.webp",
    href: reviewHref,
    alt: { en: "Need to know your next step? Request a Numu review", ar: "محتاج تعرف خطوتك الجاية؟ اطلب مراجعة نمو" },
  },
  {
    id: "omnichannel",
    image: "/swiper/omnichannel.webp",
    placeholder: "/swiper/omnichannel-ph.webp",
    href: "/inbox",
    alt: { en: "All your messages in one place — open the omnichannel inbox", ar: "كل رسايلك في مكان واحد — افتح الـ Omnichannel Inbox" },
  },
];
