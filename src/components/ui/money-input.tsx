import { forwardRef, useEffect, useState, type InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { parseMoneyToCents } from "@/lib/money-parse";

interface MoneyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Value in minor units (cents / piastres). */
  cents: number;
  onChangeCents: (cents: number) => void;
  /** Suffix chip, e.g. "EGP". */
  currency?: string;
}

function centsToText(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Money field that does NOT reformat while you type.
 *
 * The previous pattern — `value={(cents/100).toFixed(2)}` with
 * `Math.round(Number(v)*100)` on every keystroke — rewrote the text after
 * each character, so typing "120" produced "1.00" → "1.002" → … and a
 * merchant ended up with 120.01 (12001 cents) stored on a shipping rate
 * and copied onto every order. Here the text is local state while
 * focused; the parent gets clean integer cents on every change and the
 * field snaps to two decimals only on blur.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { cents, onChangeCents, currency, className, onBlur, onFocus, ...rest },
  ref,
) {
  const [text, setText] = useState(() => centsToText(cents));
  const [focused, setFocused] = useState(false);

  // Follow external changes (reset, load) but never while the user types.
  useEffect(() => {
    if (!focused) setText(centsToText(cents));
  }, [cents, focused]);

  return (
    <div className="relative">
      <Input
        ref={ref}
        type="text"
        inputMode="decimal"
        dir="ltr"
        autoComplete="off"
        value={text}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          onChangeCents(parseMoneyToCents(raw));
        }}
        onBlur={(e) => {
          setFocused(false);
          const c = parseMoneyToCents(text);
          onChangeCents(c);
          setText(centsToText(c));
          onBlur?.(e);
        }}
        className={cn("tabular-nums", currency && "pe-14", className)}
        {...rest}
      />
      {currency && (
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">
          {currency}
        </span>
      )}
    </div>
  );
});

export default MoneyInput;
