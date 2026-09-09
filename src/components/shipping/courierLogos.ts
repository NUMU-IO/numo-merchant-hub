/**
 * Which couriers we have a real logo file for.
 *
 * Files are `public/couriers/<key>.png`, each padded to a 128×128 square
 * so every mark renders in the same tile. Keys are seed keys for Tier 3
 * companies and carrier slugs for registry carriers.
 *
 * **Only marks confirmed to belong to the company are listed.** Google's
 * favicon service returns Webflow's logo for Flextock (their site is
 * built on Webflow), clipart for Barashout and a generic globe for Egypt
 * Post — so Flextock and Barashout come from the companies' own sites,
 * and Egypt Post and Cathedis have no file and fall back to a monogram.
 *
 * Bosta is deliberately absent: `CarrierMark` draws it as inline SVG,
 * which stays crisp at any size, and a PNG would be a downgrade.
 *
 * This lives apart from both components because both need it, and
 * importing one from the other made a cycle.
 */

const LOGOS: Record<string, string> = {
  waselha: "/couriers/waselha.png",
  flextock: "/couriers/flextock.png",
  holyship: "/couriers/holyship.png",
  barashout: "/couriers/barashout.png",
  sprint: "/couriers/sprint.png",
  mylerz: "/couriers/mylerz.png",
  jt: "/couriers/jt.png",
};

export function courierLogoSrc(key: string | null | undefined): string | null {
  return (key && LOGOS[key]) || null;
}
