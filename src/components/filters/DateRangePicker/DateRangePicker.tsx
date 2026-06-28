/**
 * Public surface: the trigger button + popover. Lazy-loads the
 * heavy inner panel so the picker contributes only ~2 KB to the
 * initial bundle until the merchant clicks to open it.
 */

import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

import { triggerLabel } from "./format";
import type { DateRange } from "./types";

const DateRangePickerContent = lazy(
  () => import("./DateRangePickerContent"),
);

interface DateRangePickerProps {
  value: DateRange;
  onChange: (next: DateRange) => void;
  className?: string;
  /** Compact variant used inside the analytics header. */
  size?: "sm" | "md";
  align?: "start" | "center" | "end";
}

export function DateRangePicker({
  value,
  onChange,
  className,
  size = "md",
  align = "start",
}: DateRangePickerProps) {
  const { language } = useLanguage();
  const lang = language === "ar" ? "ar" : "en";
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size={size === "sm" ? "sm" : "default"}
          className={cn(
            "gap-1.5 font-normal",
            size === "sm" ? "h-8 text-xs" : "h-9 text-sm",
            className,
          )}
        >
          <CalendarIcon
            className={cn(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")}
          />
          <span className="truncate max-w-[220px]">
            {triggerLabel(value, lang)}
          </span>
          <ChevronDown
            className={cn(
              "opacity-60",
              size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5",
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-auto border shadow-lg"
        align={align}
        sideOffset={6}
      >
        <Suspense
          fallback={
            <div className="w-[760px] max-w-[95vw] h-[488px] grid place-items-center text-xs text-muted-foreground">
              {lang === "ar" ? "جارٍ التحميل…" : "Loading…"}
            </div>
          }
        >
          <DateRangePickerContent
            value={value}
            lang={lang}
            onApply={(r) => {
              onChange(r);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}
