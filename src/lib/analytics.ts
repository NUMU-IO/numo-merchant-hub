/**
 * PostHog — product analytics for the NUMU team.
 *
 * Internal instrumentation. Merchants never see it and it changes nothing
 * about how the hub behaves; it exists so we can answer "where do
 * merchants stall on the way to their first sale" without guessing.
 *
 * **No session replay, and no autocapture.** This is the important
 * difference from the landing page, which has both. Every screen in this
 * app can contain real customer data — names, phone numbers, delivery
 * addresses, order contents. Replay would ship all of it to a third
 * party. Autocapture is subtler and just as bad: it records the text of
 * whatever was clicked, so one click on a row in the orders table sends
 * us a customer's name as an event property. Both are off, and every
 * event here is one somebody deliberately wrote.
 *
 * That leaves explicit events, which is what we actually want from a
 * dashboard anyway — "merchant finished onboarding step 3" is a real
 * question; "merchant clicked a div" is not.
 *
 * Merchants are identified by account id and grouped by tenant, so a
 * funnel can be read per merchant rather than per browser. The
 * properties we attach are commercial (plan, lifecycle, trial) and never
 * personal.
 *
 * Disabled entirely when `VITE_POSTHOG_KEY` is unset — local development
 * and CI send nothing.
 */

import type { PostHog } from "posthog-js";

/** Events we deliberately capture. A union, so typos fail the build. */
export type AnalyticsEvent =
  | "onboarding_started"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "onboarding_skipped"
  | "store_created"
  | "product_created"
  | "business_profile_saved";

type Props = Record<string, string | number | boolean | null | undefined>;

let client: PostHog | null = null;

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST =
  (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ??
  "https://eu.i.posthog.com";

/**
 * Staff domains. Our own sessions are the single biggest source of noise
 * in a merchant funnel — we open the hub far more often than any merchant
 * does, and we do unrepresentative things in it.
 *
 * This tags rather than blocks: the events still arrive, and PostHog
 * filters them out with one cohort condition. Dropping them outright
 * would make debugging our own instrumentation impossible.
 */
const STAFF_EMAIL_DOMAINS = ["numueg.app", "eshtarek.app"];

function isStaffEmail(email: string | null | undefined): boolean {
  const domain = (email ?? "").toLowerCase().split("@")[1] ?? "";
  return STAFF_EMAIL_DOMAINS.includes(domain);
}

/** Load and start PostHog. No-ops when unconfigured. */
export function initAnalytics(): void {
  if (!KEY || client) return;

  import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        defaults: "2026-05-30",
        person_profiles: "identified_only",
        // See the module docstring. Both of these would capture live
        // customer data off the merchant's screen.
        disable_session_recording: true,
        autocapture: false,
      });
      client = posthog;
    })
    .catch(() => {
      // Blocked by an ad blocker, offline, or a failed chunk. None of
      // those are worth a console error in a merchant's dashboard.
    });
}

/**
 * Tie this session to a merchant account.
 *
 * Deliberately excludes name and phone. `email` is passed only to derive
 * the staff flag and to let us find our own test accounts; if that ever
 * feels like too much, the flag can be computed by the caller instead.
 */
export function identifyMerchant(user: {
  id: string;
  email?: string | null;
  role?: string | null;
  is_verified?: boolean;
  created_at?: string;
}): void {
  if (!client) return;

  client.identify(user.id, {
    role: user.role ?? null,
    is_verified: user.is_verified ?? null,
    signed_up_at: user.created_at ?? null,
    is_staff: isStaffEmail(user.email),
  });
}

/**
 * Attach the session to a tenant, so funnels can be read per merchant
 * business rather than per logged-in user. A tenant with three staff
 * accounts is one merchant, and without this it looks like three.
 */
export function setTenantGroup(tenant: {
  id: string;
  name?: string;
  plan?: string;
  lifecycle_state?: string;
  is_demo?: boolean;
  is_on_trial?: boolean;
}): void {
  client?.group("tenant", tenant.id, {
    name: tenant.name,
    plan: tenant.plan,
    lifecycle_state: tenant.lifecycle_state,
    is_demo: tenant.is_demo,
    is_on_trial: tenant.is_on_trial,
  });
}

/** Capture an event. No-ops when analytics is off or still loading. */
export function track(event: AnalyticsEvent, props?: Props): void {
  client?.capture(event, props);
}

/**
 * Forget this person on sign-out.
 *
 * Without it, the next merchant to sign in on a shared machine inherits
 * the previous one's distinct id and their events merge into one person.
 */
export function resetAnalytics(): void {
  client?.reset();
}
