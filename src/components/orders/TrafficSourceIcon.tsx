/**
 * TrafficSourceIcon — small brand glyph for a checkout/order traffic
 * source (utm_source). Meta and TikTok get their real logos (following
 * the WhatsAppGlyph precedent — lucide ships no brand marks), WhatsApp
 * reuses the existing glyph, and any other non-empty source falls back
 * to a generic globe. Renders nothing when the source is unknown/empty.
 *
 * The storefront writes utm_source either from the merchant's tagged
 * campaign links or derived from ad-platform click ids
 * (fbclid → "facebook", ttclid → "tiktok", gclid → "google"), so the
 * slugs matched here are stable platform identifiers, not free text.
 */

import { Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatsAppGlyph } from "@/components/whatsapp/WhatsAppGlyph";

export type TrafficPlatform = "meta" | "tiktok" | "whatsapp" | "generic";

const META_SOURCES = new Set([
  "facebook",
  "fb",
  "instagram",
  "ig",
  "meta",
  "messenger",
]);
const TIKTOK_SOURCES = new Set(["tiktok", "tik_tok", "tt"]);
const WHATSAPP_SOURCES = new Set(["whatsapp", "wa"]);

export function classifyTrafficSource(
  source: string | null | undefined,
): TrafficPlatform | null {
  if (!source) return null;
  const s = source.trim().toLowerCase();
  if (!s) return null;
  if (META_SOURCES.has(s)) return "meta";
  if (TIKTOK_SOURCES.has(s)) return "tiktok";
  if (WHATSAPP_SOURCES.has(s)) return "whatsapp";
  return "generic";
}

function MetaGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.553-1.574a3.14 3.14 0 0 1 1.068-.244z" />
    </svg>
  );
}

function TikTokGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

interface TrafficSourceIconProps {
  source: string | null | undefined;
  className?: string;
}

export function TrafficSourceIcon({ source, className }: TrafficSourceIconProps) {
  const platform = classifyTrafficSource(source);
  if (!platform) return null;

  switch (platform) {
    case "meta":
      return <MetaGlyph className={cn("text-[#0866FF]", className)} />;
    case "tiktok":
      return <TikTokGlyph className={cn("text-foreground", className)} />;
    case "whatsapp":
      return <WhatsAppGlyph className={cn("text-[#25D366]", className)} />;
    default:
      return <Globe className={cn("text-muted-foreground", className)} />;
  }
}
