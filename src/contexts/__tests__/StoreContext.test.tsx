import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StoreProvider, useDashboardStore } from "../StoreContext";

const listStores = vi.hoisted(() => vi.fn());

vi.mock("../AuthContext", () => ({ useAuth: () => ({ isAuthenticated: true, isLoading: false }) }));
vi.mock("@/services/storeApi", () => ({ listStores, getCustomDomain: vi.fn() }));

let refetch: () => Promise<void> = async () => {};

function Probe() {
  const { hasStores, loadError, isLoading, refetchStores } = useDashboardStore();
  refetch = refetchStores;
  return <p>{isLoading ? "loading" : `stores=${hasStores} error=${loadError}`}</p>;
}

describe("StoreProvider", () => {
  it("reports a failed fetch as an error, not as a merchant with no stores", async () => {
    listStores.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByText("stores=false error=true")).toBeInTheDocument());
  });

  it("keeps the loaded stores when a later refetch fails", async () => {
    listStores.mockResolvedValueOnce({ items: [{ id: "s1" }] });
    render(<StoreProvider><Probe /></StoreProvider>);
    await waitFor(() => expect(screen.getByText("stores=true error=false")).toBeInTheDocument());

    listStores.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await act(() => refetch());
    expect(screen.getByText("stores=true error=true")).toBeInTheDocument();
  });
});
