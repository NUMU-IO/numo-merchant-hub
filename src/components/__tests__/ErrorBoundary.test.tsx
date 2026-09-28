import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "../ErrorBoundary";

const captureException = vi.hoisted(() => vi.fn());

vi.mock("@sentry/react", () => ({ captureException }));
vi.mock("@/lib/register-sw", () => ({ recoverFromStaleAssets: vi.fn() }));
vi.mock("@/i18n", () => ({ default: { t: (key: string, fallback?: string) => fallback ?? key } }));

function Boom(): never {
  throw new TypeError("Importing a module script failed.");
}

describe("ErrorBoundary stale chunk after a recovery reload", () => {
  afterEach(() => {
    captureException.mockReset();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("shows the offline message and reports a grouped warning", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sessionStorage.setItem("numu:stale-chunk-reload", String(Date.now()));
    render(<ErrorBoundary><Boom /></ErrorBoundary>);

    expect(screen.getByText("shell.offlineTitle")).toBeInTheDocument();
    expect(screen.queryByText("Importing a module script failed.")).toBeNull();
    expect(captureException).toHaveBeenCalledWith(
      expect.any(TypeError),
      expect.objectContaining({ level: "warning", fingerprint: ["stale-chunk-after-recovery"] }),
    );
  });

  it("reports nothing when the browser knows it is offline", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    sessionStorage.setItem("numu:stale-chunk-reload", String(Date.now()));
    render(<ErrorBoundary><Boom /></ErrorBoundary>);

    expect(captureException).not.toHaveBeenCalled();
  });
});
