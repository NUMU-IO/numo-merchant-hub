import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { FounderBadge } from "../FounderBadge";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ language: "ar" }),
}));

describe("FounderBadge", () => {
  it("renders nothing without a cohort", () => {
    // Not a founder. An empty shell would leave a stray border in the
    // sidebar next to every non-founder's store name.
    const { container } = render(<FounderBadge cohort={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an undefined cohort", () => {
    // /auth/me can answer before the tenant resolves.
    const { container } = render(<FounderBadge cohort={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels the chip without exposing a rank", () => {
    render(<FounderBadge cohort="2025" />);
    expect(screen.getByText("تاجر مؤسس")).toBeInTheDocument();
    // The chip carries no number at all — not the cohort, and never a rank.
    expect(screen.queryByText(/2025/)).not.toBeInTheDocument();
    expect(screen.queryByText(/#/)).not.toBeInTheDocument();
  });

  it("gives the icon-only variant an accessible name", () => {
    // In an order row the mark stands alone, so the label has to reach a
    // screen reader some other way.
    render(<FounderBadge cohort="2025" size="mark" />);
    expect(screen.getByRole("img", { name: "تاجر مؤسس" })).toBeInTheDocument();
  });

  it("shows the cohort year on the seal, where there is room to explain it", () => {
    render(<FounderBadge cohort="2025" size="seal" />);
    expect(screen.getByText("فوج 2025")).toBeInTheDocument();
    expect(screen.getByText("من أوائل التجار على نُمو")).toBeInTheDocument();
  });

  it("never renders a rank on any size", () => {
    for (const size of ["mark", "chip", "seal"] as const) {
      const { container, unmount } = render(
        <FounderBadge cohort="2025" size={size} />,
      );
      expect(container.textContent).not.toMatch(/#\s*\d/);
      unmount();
    }
  });
});
