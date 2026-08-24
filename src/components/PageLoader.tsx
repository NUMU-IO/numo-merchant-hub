import { Loader2 } from "lucide-react";
import { BrandLoader } from "./NumuLoader/BrandLoader";

interface PageLoaderProps {
  fullScreen?: boolean;
}

/**
 * In-app loading state (Suspense fallback, page-level fetches).
 * Renders the canonical NUMU brand loader on a transparent background so
 * it sits naturally inside whatever surface is loading.
 */
export function PageLoader({ fullScreen = false }: PageLoaderProps) {
  return (
    <div
      className={`flex items-center justify-center ${fullScreen ? "min-h-screen" : "min-h-[50vh]"}`}
    >
      <div className="animate-in fade-in duration-500">
        <BrandLoader />
      </div>
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin text-muted-foreground ${className}`} />;
}
