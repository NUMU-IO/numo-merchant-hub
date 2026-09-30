import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

const apiClientBlob = vi.fn();
let token: string | null = null;

vi.mock("@/services/api", () => ({
  apiClientBlob: (...args: unknown[]) => apiClientBlob(...args),
  getImpersonationToken: () => token,
}));

import { ApiImage } from "../ApiImage";

const PATH = "/api/v1/stores/s1/payment-proofs/p1/image";

describe("ApiImage", () => {
  beforeEach(() => {
    apiClientBlob.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:proof");
    URL.revokeObjectURL = vi.fn();
  });

  it("loads directly on a merchant's own cookie session", () => {
    token = null;
    const { container } = render(<ApiImage path={PATH} alt="" />);
    expect(container.querySelector("img")?.getAttribute("src")).toContain(PATH);
    expect(apiClientBlob).not.toHaveBeenCalled();
  });

  it("fetches through the API client while impersonating", async () => {
    // <img> can't send the impersonation Bearer; the API client does.
    token = "handoff";
    apiClientBlob.mockResolvedValue(new Blob(["x"]));
    const { container } = render(<ApiImage path={PATH} alt="" />);
    await waitFor(() =>
      expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:proof"),
    );
    expect(apiClientBlob).toHaveBeenCalledWith("/stores/s1/payment-proofs/p1/image");
  });
});
