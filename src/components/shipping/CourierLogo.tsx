/**
 * A courier company's own logo, where we have it.
 *
 * Most Tier 3 couriers in the seed list are a name and a phone number —
 * a rider on a motorbike has no logo. Four of them are real companies a
 * merchant will recognise on sight, so showing the mark beats showing
 * the transliterated name.
 *
 * Files live in `public/couriers/<key>.png`, downscaled to 64px tall
 * from each company's own site. The map is here rather than on the API
 * because the files are hub assets — the API has no way to know whether
 * one is actually present, and declaring a logo that 404s is worse than
 * declaring none.
 *
 * Anything without a file renders nothing, so the caller's own fallback
 * (the courier's name) shows through.
 */

const LOGOS: Record<string, string> = {
  waselha: "/couriers/waselha.png",
  flextock: "/couriers/flextock.png",
  holyship: "/couriers/holyship.png",
  barashout: "/couriers/barashout.png",
};

export const CourierLogo = ({
  seedKey,
  name,
  height = 18,
}: {
  seedKey: string | null | undefined;
  /** Used as the alt text — a logo nobody can see is still a courier. */
  name: string;
  height?: number;
}) => {
  const src = seedKey ? LOGOS[seedKey] : undefined;
  if (!src) return null;
  return (
    <img
      src={src}
      alt={name}
      height={height}
      style={{ height, width: "auto" }}
      className="max-w-[110px] object-contain"
      loading="lazy"
      // A missing file must not leave a broken-image icon on the card.
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
};
