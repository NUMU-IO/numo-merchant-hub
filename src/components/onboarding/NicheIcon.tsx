/**
 * Duotone icons for the onboarding "what do you sell" tiles.
 *
 * Each one draws the product itself — a dress, a lipstick, a sofa, a bowl
 * with steam — rather than a symbol for the category. A soft fill of the
 * tile's hue sits under a stroke of the same hue, which is most of what
 * separates these from a stock icon pack. Both fill and stroke use
 * `currentColor`, so the wrapper decides the colour: the category hue at
 * rest, white on the selected tile.
 *
 * Hand-authored on a 24-unit grid. Kept as markup strings rather than JSX
 * so the paths stay readable and portable; they are static and ours, so
 * `dangerouslySetInnerHTML` carries no untrusted input.
 */

export type NicheIconKind =
  | "fashion"
  | "electronics"
  | "beauty"
  | "home"
  | "food"
  | "accessories"
  | "other";

const PATHS: Record<NicheIconKind, string> = {
  // a dress: bodice, waist, flared skirt
  fashion:
    '<path d="M9 3.5h6l1.6 4.2-2.1 1.8.3 2.2 4.2 9.3H5l4.2-9.3.3-2.2-2.1-1.8z"/>' +
    '<path d="M10.4 3.5c.4 1.3 2.8 1.3 3.2 0M9.3 11.7h5.4" fill="none"/>',
  // laptop with a phone leaning on it
  electronics:
    '<rect x="3" y="5" width="13.5" height="9.5" rx="1.6"/>' +
    '<path d="M1.8 17.5h14.7" fill="none"/>' +
    '<rect x="15.5" y="9" width="6.5" height="11.5" rx="1.4" fill-opacity=".38"/>' +
    '<path d="M18.2 18.6h1.1" fill="none"/>',
  // lipstick: tube, cap ring, angled bullet
  beauty:
    '<rect x="8.5" y="11.5" width="7" height="9.5" rx="1.2"/>' +
    '<path d="M8.5 13.5h7" fill="none"/>' +
    '<path d="M10 11.5V6.2l4-2.4v7.7z" fill-opacity=".38"/>',
  // sofa: back, seat, arms, feet
  home:
    '<path d="M6 11V7.5A2.5 2.5 0 0 1 8.5 5h7A2.5 2.5 0 0 1 18 7.5V11" fill="none"/>' +
    '<path d="M4.5 11h15a1.5 1.5 0 0 1 1.5 1.5V17H3v-4.5A1.5 1.5 0 0 1 4.5 11z"/>' +
    '<path d="M12 11v6M4.5 17v2M19.5 17v2" fill="none"/>',
  // bowl with steam
  food:
    '<path d="M3 12.5h18a9 9 0 0 1-18 0z"/>' +
    '<path d="M6.5 16.5h11" fill="none" stroke-width="1.2"/>' +
    '<path d="M9 9c0-1.6 1.6-1.8 1.6-3.4M13.4 9c0-1.6 1.6-1.8 1.6-3.4" fill="none"/>',
  // sunglasses
  accessories:
    '<path d="M2.5 10.5h7.5v3.5a3.2 3.2 0 0 1-3.2 3.2H5.7a3.2 3.2 0 0 1-3.2-3.2z"/>' +
    '<path d="M14 10.5h7.5V14a3.2 3.2 0 0 1-3.2 3.2h-1.1a3.2 3.2 0 0 1-3.2-3.2z"/>' +
    '<path d="M10 12.2c.6-1 3.4-1 4 0M2.5 10.5L4.4 7M21.5 10.5L19.6 7" fill="none"/>',
  // three filled tiles and one left for you to fill in
  other:
    '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/>' +
    '<rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/>' +
    '<rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/>' +
    '<rect x="13.5" y="13.5" width="7" height="7" rx="1.6" fill="none" stroke-dasharray="2.2 1.8"/>',
};

interface NicheIconProps {
  kind: NicheIconKind;
  className?: string;
}

export function NicheIcon({ kind, className = "h-7 w-7" }: NicheIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      fillOpacity={0.16}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      dangerouslySetInnerHTML={{ __html: PATHS[kind] }}
    />
  );
}
