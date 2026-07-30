/**
 * Tracking-credential validation rules for the Meta / TikTok settings panels.
 *
 * Why this file exists
 * --------------------
 * These rules used to be retyped as literals in `MetaTrackingPanel`,
 * `MetaTrackingAdvancedSettings`, the API's Pydantic schemas and the
 * storefront. They drifted, and the drift was merchant-visible: a real
 * 17-digit Meta Pixel ID was rejected by a `/^\d{15,16}$/` whitelist here
 * and in the API while the storefront rendered it fine.
 *
 * So: the API is now the authority. `useTrackingContract()` fetches
 * `GET /stores/{id}/settings/tracking/validation-contract` and the panels
 * validate against whatever it returns — meaning the API can loosen a rule
 * without a hub deploy, and the hub can never end up stricter than the
 * endpoint it posts to (the old `MIN_CAPI_TOKEN_LENGTH = 50` vs the API's
 * `min_length=20` was exactly that bug).
 *
 * The constants below are the offline fallback, used before the fetch
 * resolves and if it fails. They mirror the server's defaults; if they ever
 * disagree, the server wins the moment its response lands.
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api";

export interface PlatformValidationRules {
  /** Regex source string — safe to pass to `new RegExp()`. */
  pixel_id: string;
  pixel_id_error: string;
  test_event_code: string;
  test_event_code_error: string;
  min_token_length: number;
}

export interface TrackingValidationContract {
  meta: PlatformValidationRules;
  tiktok: PlatformValidationRules;
}

/**
 * Offline fallback. Mirrors
 * `NUMU-api/src/api/v1/schemas/tenant/tracking_validation.py`.
 *
 * Meta's pixel bound is 6–20 digits, derived from the actual constraint
 * (IDs are allocated from a 64-bit space; unsigned max is 20 digits) rather
 * than from the "15–16 digits" folklore that third-party blogs repeat. It
 * cannot reject a valid ID while still catching `act_123…`, URLs, letters
 * and empty input.
 */
export const DEFAULT_TRACKING_CONTRACT: TrackingValidationContract = {
  meta: {
    pixel_id: "^\\d{6,20}$",
    pixel_id_error: "Pixel ID must be numeric (up to 20 digits)",
    test_event_code: "^[A-Za-z0-9_-]{1,64}$",
    test_event_code_error: "Test event code must be alphanumeric",
    min_token_length: 20,
  },
  tiktok: {
    pixel_id: "^[A-Za-z0-9]{6,40}$",
    pixel_id_error: "Pixel Code must be 6-40 alphanumeric characters",
    test_event_code: "^[A-Za-z0-9_-]{1,64}$",
    test_event_code_error: "Test event code must be alphanumeric",
    min_token_length: 10,
  },
};

/**
 * Compile a contract pattern, falling back to the built-in default if the
 * server ever sends something `RegExp` can't parse.
 *
 * Anchored explicitly with `^`/`$` already present in the source strings.
 * Note the deliberate absence of flags: these are ASCII-only shapes and a
 * case-insensitive or unicode mode would change what they accept.
 */
export function compilePattern(source: string, fallback: string): RegExp {
  try {
    return new RegExp(source);
  } catch {
    return new RegExp(fallback);
  }
}

/**
 * The rules the panels should validate against.
 *
 * Cached for the session (`staleTime: Infinity`) — a validation contract
 * does not change mid-session, and the panels re-read it on every keystroke.
 * Returns the offline fallback while loading or on error, so a panel is
 * never left without a rule to check against.
 */
export function useTrackingContract(storeId?: string) {
  const query = useQuery({
    queryKey: ["tracking-validation-contract", storeId],
    queryFn: () =>
      apiClient<TrackingValidationContract>(
        `/stores/${storeId}/settings/tracking/validation-contract`,
      ),
    enabled: !!storeId,
    staleTime: Infinity,
    retry: 1,
  });

  return query.data ?? DEFAULT_TRACKING_CONTRACT;
}
