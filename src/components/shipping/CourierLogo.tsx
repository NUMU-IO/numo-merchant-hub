/**
 * A courier company's own logo, in the same tile every carrier uses.
 *
 * The first cut rendered each logo at its own aspect ratio, so a row of
 * couriers showed marks 45px, 28px, 19px and 14px wide — nothing lined
 * up and the wordmarks were too small to read. Every mark is now padded
 * to a square file and drawn inside a fixed `size × size` rounded tile,
 * the same shape and size `CarrierMark` uses for Bosta and the
 * monograms, so a manual courier and a registry carrier look like the
 * same kind of thing.
 *
 * Files live in `public/couriers/<key>.png` at 128×128. The map is here
 * rather than on the API because the files are hub assets — the API has
 * no way to know whether one is present, and declaring a logo that 404s
 * is worse than declaring none.
 *
 * **Only marks confirmed to belong to the company are listed.** Google's
 * favicon service returns Webflow's logo for Flextock (their site is
 * built on Webflow), clipart for Barashout and a generic globe for Egypt
 * Post, so those came from the companies' own sites or were left out.
 * A courier with no file falls back to its monogram.
 */

import { CarrierMark } from "./CarrierMark";
import { courierLogoSrc } from "./courierLogos";


export const CourierLogo = ({
  seedKey,
  name,
  size = 28,
  brandColor,
  className = "",
}: {
  /** Seed key or carrier slug. Anything unknown falls back to a monogram. */
  seedKey: string | null | undefined;
  /** Alt text, and the monogram source when there is no logo. */
  name: string;
  size?: number;
  brandColor?: string | null;
  className?: string;
}) => {
  const src = courierLogoSrc(seedKey);
  if (!src) {
    return (
      <CarrierMark
        slug={seedKey || ""}
        name={name}
        brandColor={brandColor}
        size={size}
        className={className}
      />
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted/40 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        /* Contain, not cover: a wordmark cropped to a square is unreadable. */
        style={{ width: "82%", height: "82%", objectFit: "contain" }}
        loading="lazy"
        /* A missing file must not leave a broken-image icon on the card. */
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </span>
  );
};
