import * as React from "react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";
import { Check, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useLanguage } from "@/contexts/LanguageContext";

// Unicode regional-indicator flag emoji from the ISO 3166-1 alpha-2 code.
// Lets us avoid shipping any image assets for ~250 flags.
const flagEmoji = (iso2: string): string => {
  if (iso2.length !== 2) return "🏳️";
  const base = 0x1f1e6;
  const a = iso2.toUpperCase().charCodeAt(0) - 65;
  const b = iso2.toUpperCase().charCodeAt(1) - 65;
  return String.fromCodePoint(base + a, base + b);
};

// English country names for the dropdown filter. We deliberately don't
// localise to Arabic — the search input is for keyboard-typers, not
// shoppers — and 250 ISO names doubles the bundle for marginal gain.
// Display order in the dropdown puts MENA-relevant countries first.
const COUNTRY_NAMES_EN: Record<string, string> = {
  EG: "Egypt",
  SA: "Saudi Arabia",
  AE: "United Arab Emirates",
  KW: "Kuwait",
  QA: "Qatar",
  BH: "Bahrain",
  OM: "Oman",
  JO: "Jordan",
  LB: "Lebanon",
  IQ: "Iraq",
  YE: "Yemen",
  PS: "Palestine",
  SD: "Sudan",
  LY: "Libya",
  TN: "Tunisia",
  DZ: "Algeria",
  MA: "Morocco",
  US: "United States",
  GB: "United Kingdom",
  TR: "Turkey",
  DE: "Germany",
  FR: "France",
  CA: "Canada",
};

const PRIORITY_COUNTRIES: CountryCode[] = [
  "EG",
  "SA",
  "AE",
  "KW",
  "QA",
  "BH",
  "OM",
  "JO",
  "LB",
  "MA",
];

type AllCountries = ReturnType<typeof getCountries>;

const ALL_COUNTRIES: AllCountries = getCountries();

// Build the dropdown ordering once at module load. Priority countries
// first (in PRIORITY_COUNTRIES order), then every other country alpha by
// English name.
const COUNTRY_OPTIONS: CountryCode[] = (() => {
  const prioritySet = new Set(PRIORITY_COUNTRIES);
  const rest = ALL_COUNTRIES.filter((c) => !prioritySet.has(c)).sort((a, b) =>
    (COUNTRY_NAMES_EN[a] ?? a).localeCompare(COUNTRY_NAMES_EN[b] ?? b),
  );
  return [...PRIORITY_COUNTRIES.filter((c) => ALL_COUNTRIES.includes(c)), ...rest];
})();

const labelFor = (iso2: CountryCode): string =>
  COUNTRY_NAMES_EN[iso2] ?? iso2;

const dialFor = (iso2: CountryCode): string =>
  `+${getCountryCallingCode(iso2)}`;

const detectCountry = (
  value: string | null | undefined,
  fallback: CountryCode,
): CountryCode => {
  if (!value) return fallback;
  try {
    const parsed = parsePhoneNumberFromString(value);
    if (parsed?.country) return parsed.country;
  } catch {
    /* fall through */
  }
  return fallback;
};

const stripDial = (value: string | null | undefined, country: CountryCode): string => {
  if (!value) return "";
  const dial = dialFor(country).replace(/\D/g, "");
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith(dial)) {
    return digits.slice(dial.length);
  }
  return digits;
};

export interface PhoneInputProps {
  /** Canonical E.164 string, e.g. `+201001234567`. May be empty/`null` when no number is set. */
  value: string | null | undefined;
  /** Fires whenever the user edits the local digits or picks a country. Emits canonical E.164, or `""` if the field is empty. Emits the raw partial digits when not yet a valid number — call sites that need *only* valid E.164 should also check `isValid` below or call `isValidPhoneNumber` themselves. */
  onChange: (e164: string) => void;
  /** ISO 3166-1 alpha-2 hint for the initial country if `value` doesn't tell us. */
  defaultCountry?: CountryCode;
  /** Marks the local-number input as required (visual + form-level only — submission gating is the caller's job). */
  required?: boolean;
  /** Disables both the country selector and the digits field. */
  disabled?: boolean;
  /** Field id, for `<label htmlFor>` association. */
  id?: string;
  /** Placeholder for the digits field. Defaults to a country-appropriate sample number. */
  placeholder?: string;
  className?: string;
  /** Extra class on the digits `<input>` itself. */
  inputClassName?: string;
  /** Shown beneath the field when set. */
  errorMessage?: string;
}

/**
 * Two-field international phone input: country combobox + local-number `<input>`.
 *
 * The component owns the country/local-digits state internally; the parent
 * only sees the canonical E.164 string via `onChange`. When `value` flips
 * from outside (e.g. a form `reset()`), the inputs re-sync.
 */
export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  function PhoneInput(
    {
      value,
      onChange,
      defaultCountry = "EG",
      required,
      disabled,
      id,
      placeholder,
      className,
      inputClassName,
      errorMessage,
    },
    ref,
  ) {
    const { language } = useLanguage();
    const isAr = language === "ar";

    const initialCountry = React.useMemo(
      () => detectCountry(value, defaultCountry),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [],
    );
    const [country, setCountry] = React.useState<CountryCode>(initialCountry);
    const [local, setLocal] = React.useState<string>(() =>
      stripDial(value, initialCountry),
    );
    const [open, setOpen] = React.useState(false);

    // Re-sync when the controlled value changes from outside (form reset,
    // load-from-server). We deliberately key off the canonical value so
    // typing locally doesn't fight with the controlled prop.
    React.useEffect(() => {
      if (!value) {
        setLocal("");
        return;
      }
      const detected = detectCountry(value, country);
      if (detected !== country) {
        setCountry(detected);
      }
      const stripped = stripDial(value, detected);
      setLocal((prev) => (prev === stripped ? prev : stripped));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    const emit = (nextCountry: CountryCode, nextLocal: string) => {
      const cleaned = nextLocal.replace(/\D/g, "");
      if (!cleaned) {
        onChange("");
        return;
      }
      const parsed = parsePhoneNumberFromString(cleaned, nextCountry);
      if (parsed?.isValid()) {
        onChange(parsed.number);
      } else {
        // Forward the digits-as-typed so the parent's form state stays
        // in sync. Final validity check happens at submit time.
        onChange(`${dialFor(nextCountry)}${cleaned}`);
      }
    };

    const handleCountrySelect = (next: CountryCode) => {
      setCountry(next);
      setOpen(false);
      emit(next, local);
    };

    const handleLocalChange = (raw: string) => {
      // Use AsYouType to keep the local field readable while typing.
      // We strip the dial prefix to keep the visible value as local digits.
      const formatter = new AsYouType(country);
      formatter.input(`${dialFor(country)}${raw.replace(/\D/g, "")}`);
      const national = formatter.getNumber()?.formatNational() ?? raw;
      setLocal(national);
      emit(country, raw);
    };

    const computedPlaceholder = React.useMemo(() => {
      if (placeholder) return placeholder;
      // Sample number per country — kept short and locale-recognisable.
      const samples: Record<string, string> = {
        EG: "100 123 4567",
        SA: "50 123 4567",
        AE: "50 123 4567",
        US: "555 123 4567",
        GB: "7400 123456",
      };
      return samples[country] ?? "Phone number";
    }, [country, placeholder]);

    const triggerLabel = (
      <span className="flex items-center gap-2 text-sm">
        <span className="text-lg leading-none" aria-hidden>
          {flagEmoji(country)}
        </span>
        <span className="font-medium text-muted-foreground">{dialFor(country)}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
      </span>
    );

    return (
      <div className={cn("space-y-1", className)}>
        <div className="flex items-stretch gap-2" dir="ltr">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              type="button"
              disabled={disabled}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-lg border bg-background px-2.5",
                "text-sm transition-colors hover:bg-muted/40 focus:outline-none",
                "focus:ring-2 focus:ring-ring/40 disabled:opacity-50 disabled:cursor-not-allowed",
              )}
              aria-label={isAr ? "اختر الدولة" : "Select country"}
            >
              {triggerLabel}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[280px] p-0">
              <Command>
                <div className="flex items-center gap-2 border-b px-3" cmdk-input-wrapper="">
                  <Search className="h-3.5 w-3.5 opacity-50" />
                  <CommandInput
                    placeholder={isAr ? "ابحث عن دولة" : "Search country"}
                    className="h-9 flex-1 border-0 bg-transparent text-sm focus:ring-0"
                  />
                </div>
                <CommandList className="max-h-[260px]">
                  <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                    {isAr ? "لا توجد نتائج" : "No country found"}
                  </CommandEmpty>
                  <CommandGroup>
                    {COUNTRY_OPTIONS.map((iso2) => {
                      const name = labelFor(iso2);
                      const dial = dialFor(iso2);
                      const selected = iso2 === country;
                      return (
                        <CommandItem
                          key={iso2}
                          value={`${name} ${dial} ${iso2}`}
                          onSelect={() => handleCountrySelect(iso2)}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="text-base leading-none">{flagEmoji(iso2)}</span>
                          <span className="flex-1">{name}</span>
                          <span className="text-xs text-muted-foreground">{dial}</span>
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Input
            ref={ref}
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            disabled={disabled}
            required={required}
            value={local}
            onChange={(e) => handleLocalChange(e.target.value)}
            placeholder={computedPlaceholder}
            className={cn("h-10 flex-1 text-sm rounded-lg", inputClassName)}
            dir="ltr"
            aria-invalid={errorMessage ? true : undefined}
          />
        </div>
        {errorMessage && (
          <p className="text-[11px] text-destructive">{errorMessage}</p>
        )}
      </div>
    );
  },
);

/**
 * Pure-function helper for call sites that just need to check whether a
 * value (E.164 or partial) is a valid number. Re-exported so consumers
 * don't have to import directly from `libphonenumber-js`.
 */
export const isValidE164 = (value: string | null | undefined): boolean => {
  if (!value) return false;
  try {
    return isValidPhoneNumber(value);
  } catch {
    return false;
  }
};
