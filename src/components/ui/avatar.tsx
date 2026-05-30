import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

/* Souq avatar — slightly rounded square (34% radius), not pure
   circle, matching NHUB's `Avatar` primitive. The fallback uses
   one of five warm tinted tones derived from a string seed so the
   same customer always gets the same color. */
const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-[34%]", className)}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full object-cover", className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

/* Souq fallback — picks one of five brand-tinted tones from a string
   seed (or random if no seed). saffron-100/sage/terra/info/navy. */
const AVATAR_TONES = [
  "bg-saffron-100 text-saffron-600",
  "bg-[hsl(118_28%_91%)] text-sage",
  "bg-[hsl(17_60%_90%)] text-terracotta",
  "bg-[hsl(212_55%_92%)] text-[hsl(212_60%_44%)]",
  "bg-[hsl(264_36%_92%)] text-[hsl(264_40%_50%)]",
] as const;

function toneFor(seed: string | undefined): string {
  if (!seed) return AVATAR_TONES[0];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

interface AvatarFallbackProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
  /** Optional seed (customer name, id, etc.) — picks a stable tone. */
  seed?: string;
}

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  AvatarFallbackProps
>(({ className, seed, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-[34%] font-extrabold tabular-nums",
      toneFor(seed),
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };
