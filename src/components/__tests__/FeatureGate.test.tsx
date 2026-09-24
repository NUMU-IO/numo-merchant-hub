import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FeatureGate } from "../FeatureGate";

type Ents = { ready: boolean; failed: boolean; has: (k: string) => boolean; flag: (k: string) => boolean };

const ents = vi.hoisted(() => ({ current: null as unknown as Ents }));

vi.mock("@/hooks/useEntitlements", () => ({ useEntitlements: () => ents.current }));
vi.mock("@/components/billing/UpgradeCard", () => ({
  UpgradeCard: ({ feature }: { feature: string }) => `upgrade ${feature}`,
}));

function given(over: Partial<Ents>) {
  ents.current = { ready: true, failed: false, has: () => true, flag: () => true, ...over };
}

describe("FeatureGate", () => {
  it("renders nothing while entitlements are loading", () => {
    given({ ready: false, has: () => false, flag: () => false });
    const { container } = render(<FeatureGate feature="custom_domain">form</FeatureGate>);
    expect(container).toBeEmptyDOMElement();
  });

  it("fails open for a feature when the fetch failed, because the API still enforces", () => {
    given({ ready: false, failed: true, has: () => false, flag: () => false });
    render(<FeatureGate feature="custom_domain">form</FeatureGate>);
    expect(screen.getByText("form")).toBeInTheDocument();
  });

  it("keeps a flag closed when the fetch failed, so unreleased UI never leaks", () => {
    given({ ready: false, failed: true, has: () => false, flag: () => false });
    const { container } = render(
      <FeatureGate flag="ff_new" feature="custom_domain">
        form
      </FeatureGate>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing, not an upsell, when the flag is off", () => {
    given({ flag: () => false, has: () => false });
    const { container } = render(
      <FeatureGate flag="ff_new" feature="custom_domain">
        form
      </FeatureGate>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("swaps in the upgrade card, a custom fallback, or nothing for an unavailable feature", () => {
    given({ has: () => false });
    const { container, rerender } = render(<FeatureGate feature="custom_domain">form</FeatureGate>);
    expect(screen.getByText("upgrade custom_domain")).toBeInTheDocument();

    rerender(
      <FeatureGate feature="custom_domain" fallback="custom">
        form
      </FeatureGate>,
    );
    expect(screen.getByText("custom")).toBeInTheDocument();

    rerender(
      <FeatureGate feature="custom_domain" fallback={null}>
        form
      </FeatureGate>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the children when the feature is available and the flag is on", () => {
    given({});
    render(
      <FeatureGate flag="ff_new" feature="custom_domain">
        form
      </FeatureGate>,
    );
    expect(screen.getByText("form")).toBeInTheDocument();
  });
});
