import { cn } from "@/lib/utils";

/* Souq skeleton — chunky 12px corners + warm surface-2→surface-3
   gradient shimmer (the `.skel` class from NHUB app.css). */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("souq-skel rounded-xl", className)} {...props} />;
}

export { Skeleton };
