import { useEffect, useState, type ReactNode } from "react";
import { Collapsible } from "@/components/ui/collapsible";

interface NavCollapsibleProps {
  /** True when the current route lives inside this group. */
  active: boolean;
  className?: string;
  /** Render-prop so the caller can rotate its own chevron from real state. */
  children: (open: boolean) => ReactNode;
}

/* Controlled sidebar group.

   The sidebar used `<Collapsible defaultOpen={active}>`, and `defaultOpen`
   is read ONCE at mount. The sidebar never remounts across client-side
   navigation, so jumping from Home to /health-score via the ⌘K palette or
   a dashboard card left Analytics collapsed — and a group the merchant
   closed by hand re-opened on every reload. Seeding from `active` and
   re-opening only when `active` flips true gives: deep links open the
   right group, navigating into a group opens it, and a manual collapse
   sticks until you leave and come back. */
export function NavCollapsible({ active, className, children }: NavCollapsibleProps) {
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      {children(open)}
    </Collapsible>
  );
}
