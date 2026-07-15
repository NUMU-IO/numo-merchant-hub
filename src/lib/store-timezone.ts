/**
 * Active store timezone — mirrors the `setActiveStoreCurrency` pattern in
 * format-money.ts. StoreContext stamps the merchant's store timezone here
 * on store switch; analytics requests send it as the `tz` query param so
 * the backend buckets calendar days on the STORE's wall clock instead of
 * UTC (which used to shift after-midnight Cairo orders onto the previous
 * day's charts).
 *
 * Default is Africa/Cairo — the platform's home market and the backend's
 * own fallback, so the two sides agree even before StoreContext hydrates.
 */

const DEFAULT_STORE_TIMEZONE = "Africa/Cairo";

let activeTimezone = DEFAULT_STORE_TIMEZONE;

export function setActiveStoreTimezone(tz?: string | null): void {
  const name = (tz ?? "").trim();
  if (!name) {
    activeTimezone = DEFAULT_STORE_TIMEZONE;
    return;
  }
  // Validate against the runtime tz database; a bad merchant-entered
  // value must degrade to the default, never break every analytics call.
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    activeTimezone = name;
  } catch {
    activeTimezone = DEFAULT_STORE_TIMEZONE;
  }
}

export function getActiveStoreTimezone(): string {
  return activeTimezone;
}
