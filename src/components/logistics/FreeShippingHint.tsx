import { Link } from "react-router-dom";

/**
 * Where free shipping is really set. Checkout prices shipping from each zone's
 * rates, so a zone ships free above an amount only with a "Free over threshold"
 * rate, and storefront themes now draw their free-shipping bar from the same
 * rates. The "Free shipping above" inputs this replaces saved a number nothing
 * read: a merchant could type 1,500 there and nothing a shopper saw or paid
 * changed.
 */
export function FreeShippingHint({ isAr, className }: { isAr: boolean; className?: string }) {
  return (
    <p className={className ?? "text-xs text-muted-foreground"}>
      {isAr
        ? "الشحن المجاني بيتظبط من أسعار مناطق الشحن: ضيف لكل منطقة سعر «شحن مجاني فوق مبلغ»، والشنطة وصفحة الدفع هيمشوا عليه."
        : "Free shipping is set in your shipping zones: give each zone a “Free over threshold” rate, and the bag and checkout follow it."}{" "}
      <Link to="/shipping/zones" className="font-medium text-primary underline-offset-4 hover:underline">
        {isAr ? "مناطق الشحن" : "Shipping zones"}
      </Link>
    </p>
  );
}
