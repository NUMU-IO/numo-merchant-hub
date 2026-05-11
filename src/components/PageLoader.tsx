import { Loader2 } from "lucide-react";
import { NuLogo } from "./NumuLoader/NuLogo";

interface PageLoaderProps {
  text?: string;
  fullScreen?: boolean;
}

export function PageLoader({ text = "Loading...", fullScreen = false }: PageLoaderProps) {
  return (
    <div className={`flex items-center justify-center ${fullScreen ? "min-h-screen" : "min-h-[50vh]"}`}>
      <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
        <div className="scale-50 opacity-80 mb-[-2rem]">
          <NuLogo />
        </div>
        <div className="flex items-center gap-2 text-muted-foreground mt-4">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-sm font-medium tracking-wide">{text}</p>
        </div>
      </div>
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={`animate-spin text-muted-foreground ${className}`} />;
}
