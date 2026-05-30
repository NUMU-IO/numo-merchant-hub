import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Compass, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

/* Souq 404 — white ground, saffron compass ichip, display heading,
   navy "back home" CTA + outline "browse dashboard". Encouraging
   tone, not a dead end. */
const NotFound = () => {
  const location = useLocation();
  const { isRTL } = useLanguage();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const Arrow = isRTL ? ArrowLeft : ArrowRight;
  const BackArrow = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <div className="ichip ichip-saffron ichip-lg mx-auto mb-6">
          <Compass />
        </div>
        <p className="souq-eyebrow mb-3">{isRTL ? "§ خطأ ٤٠٤" : "§ ERROR 404"}</p>
        <h1 className="text-[2rem] font-extrabold tracking-tight leading-tight mb-3">
          {isRTL ? "ضايع في الطريق؟" : "Lost the trail?"}
        </h1>
        <p className="text-[15px] text-ink-soft leading-relaxed mb-2">
          {isRTL
            ? "الصفحة دي مش موجودة — يمكن غيّرنا مكانها أو الرابط مكتوب غلط."
            : "We couldn't find that page — the link might be stale, or the page moved."}
        </p>
        <p className="text-[12px] text-ink-faint font-mono mb-7 break-all">{location.pathname}</p>
        <div className="flex items-center gap-3 justify-center flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <Link to="/">
              <BackArrow className="h-4 w-4" />
              {isRTL ? "ارجع للرئيسية" : "Back to dashboard"}
            </Link>
          </Button>
          <Button variant="accent" size="sm" asChild>
            <Link to="/products">
              {isRTL ? "تصفح المنتجات" : "Browse products"}
              <Arrow className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
