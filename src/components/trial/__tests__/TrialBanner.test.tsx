import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TrialBanner } from "../TrialBanner";

const tenant = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "ar" }),
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ tenant: tenant.current }),
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));

function on(days: number | null, extra: Record<string, unknown> = {}) {
  tenant.current = {
    id: "t1",
    is_on_trial: true,
    days_remaining: days,
    expires_at: "2026-10-16T00:00:00Z",
    trial_started_at: "2026-09-09T00:00:00Z",
    ...extra,
  };
}

describe("TrialBanner", () => {
  it("renders nothing when the tenant is not on a trial", () => {
    // Every merchant sees this component mounted; only trialling ones have a
    // countdown, and a stray empty strip at the top of the dashboard is worse
    // than no strip at all.
    tenant.current = { id: "t1", is_on_trial: false, days_remaining: null };
    const { container } = render(<TrialBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while /auth/me has not resolved the tenant", () => {
    tenant.current = null;
    const { container } = render(<TrialBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the lifecycle says trial but no expiry is left", () => {
    // Mid-conversion: SubscribeUseCase clears `expires_at` before the
    // lifecycle write lands, and a countdown with no date behind it would
    // render "0 days" at a merchant who has just paid.
    on(null);
    const { container } = render(<TrialBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("counts in Arabic-Indic digits with the right plural category", () => {
    // Arabic counts in categories, not singular/plural. Getting 2 wrong is
    // the tell of a machine-translated interface.
    on(2);
    expect(screen.queryByText).toBeDefined();
    render(<TrialBanner />);
    expect(screen.getByText(/باقي ٢ يومين/)).toBeInTheDocument();
  });

  it("escalates to the closing-the-storefront wording in the last days", () => {
    on(1);
    render(<TrialBanner />);
    // An alert role only in the tier that actually needs interrupting.
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/المتجر هيتقفل قدام الزباين/)).toBeInTheDocument();
  });

  it("stays low-key while there is plenty of time", () => {
    on(30);
    render(<TrialBanner />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("شوف الباقات")).toBeInTheDocument();
  });

  it("draws one tick per day of the whole trial, filled for the days left", () => {
    // The bar is the merchant's own month: 37 marks with 30 lit, not a
    // 30-mark bar that looks full on the day it expires.
    on(30);
    const { container } = render(<TrialBanner />);
    const row = container.querySelector("[aria-hidden='true'].flex");
    const ticks = Array.from(row?.children ?? []);
    expect(ticks.length).toBe(37);
    // Counted inside the tick row, not across the banner: the CTA is saffron
    // too, and a document-wide selector counted it as a 31st day.
    expect(ticks.filter((t) => t.className.includes("bg-saffron")).length).toBe(30);
  });
});
