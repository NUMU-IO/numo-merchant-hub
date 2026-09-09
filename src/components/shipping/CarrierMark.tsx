/**
 * A carrier's visual mark.
 *
 * The hub kept a hand-written inline SVG per carrier, so a carrier the
 * backend knew about but the frontend didn't had no icon at all — one
 * more reason adding a carrier needed a frontend commit.
 *
 * Real logos are kept for the carriers we have them for, because a
 * monogram is a downgrade for a brand a merchant recognises. Anything
 * else gets a monogram built from the registry's name and brand colour,
 * so a new carrier looks deliberate the moment it is registered.
 */

import { courierLogoSrc } from "./courierLogos";

interface Props {
  slug: string;
  name: string;
  brandColor?: string | null;
  size?: number;
  className?: string;
}

/** Bosta's hexagon mark (docs.bosta.co). */
const BostaMark = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <path
      d="M16 2.5 28 9.25v13.5L16 29.5 4 22.75V9.25z"
      fill="#E30613"
    />
    <path
      d="M11.5 10.5h6.2c2.4 0 3.9 1.2 3.9 3.1 0 1.3-.7 2.2-1.8 2.6 1.4.4 2.2 1.4 2.2 2.9 0 2.1-1.6 3.4-4.2 3.4h-6.3zm5.7 4.6c1 0 1.6-.5 1.6-1.3s-.6-1.2-1.6-1.2h-3v2.5zm.3 5c1.1 0 1.7-.5 1.7-1.4s-.6-1.4-1.7-1.4h-3.3v2.8z"
      fill="#fff"
    />
  </svg>
);

const KNOWN: Record<string, (p: { size: number }) => JSX.Element> = {
  bosta: BostaMark,
};

/** Two-letter monogram: initials for multi-word names, else first two. */
function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (name.trim().slice(0, 2) || "?").toUpperCase();
}

export const CarrierMark = ({
  slug,
  name,
  brandColor,
  size = 28,
  className = "",
}: Props) => {
  /* A real logo file beats a monogram for a brand a merchant recognises.
     Bosta stays on the inline SVG above — it is crisp at any size. */
  const file = courierLogoSrc(slug);
  if (file && !KNOWN[slug]) {
    return (
      <img
        src={file}
        alt={name}
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, objectFit: "contain" }}
        loading="lazy"
      />
    );
  }

  const Known = KNOWN[slug];
  if (Known) {
    return (
      <span className={className} aria-hidden="true">
        <Known size={size} />
      </span>
    );
  }

  const color = brandColor || "#71717A";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}1A`,
        color,
        fontSize: size * 0.4,
        /* Latin monogram stays LTR even in an Arabic UI. */
        direction: "ltr",
      }}
      aria-hidden="true"
    >
      {monogram(name)}
    </span>
  );
};
