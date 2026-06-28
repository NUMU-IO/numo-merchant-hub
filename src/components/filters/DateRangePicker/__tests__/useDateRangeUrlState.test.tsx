import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useEffect } from "react";

import { lastNRange, todayRange } from "../presets";
import { useDateRangeUrlState } from "../useDateRangeUrlState";

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>;
}

function wrapperWith(initial: string) {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>
  );
}

describe("useDateRangeUrlState", () => {
  it("defaults to last 30 days when no params are present", () => {
    const { result } = renderHook(() => useDateRangeUrlState(), { wrapper });
    expect(result.current.range.preset).toBe("last-n");
    expect(result.current.range.lastN).toEqual({ n: 30, unit: "day" });
  });

  it("hydrates from URL params", () => {
    const url =
      "/?from=2026-05-01T00:00:00.000Z&to=2026-05-15T23:59:59.999Z&preset=mtd&g=day";
    const { result } = renderHook(() => useDateRangeUrlState(), {
      wrapper: wrapperWith(url),
    });
    expect(result.current.range.preset).toBe("mtd");
    expect(result.current.range.start.toISOString()).toBe(
      "2026-05-01T00:00:00.000Z",
    );
    expect(result.current.range.end.toISOString()).toBe(
      "2026-05-15T23:59:59.999Z",
    );
  });

  it("falls back to defaults on invalid input", () => {
    const url = "/?from=garbage&to=alsogarbage&preset=mtd";
    const { result } = renderHook(() => useDateRangeUrlState(), {
      wrapper: wrapperWith(url),
    });
    expect(result.current.range.preset).toBe("last-n");
  });

  it("writes the range to the URL", async () => {
    let location: ReturnType<typeof useLocation> | null = null;
    function Spy() {
      const loc = useLocation();
      useEffect(() => {
        location = loc;
      });
      return null;
    }
    const { result } = renderHook(
      () => {
        return useDateRangeUrlState();
      },
      {
        wrapper: ({ children }) => (
          <MemoryRouter initialEntries={["/"]}>
            <Spy />
            {children}
          </MemoryRouter>
        ),
      },
    );

    const today = todayRange(new Date("2026-05-15T14:30:00Z"));
    act(() => {
      result.current.setRange(today);
    });

    await waitFor(() => {
      expect(location?.search).toContain("preset=today");
      expect(location?.search).toContain("from=");
      expect(location?.search).toContain("to=");
    });
  });

  it("clears last-n params when leaving last-n preset", async () => {
    let location: ReturnType<typeof useLocation> | null = null;
    function Spy() {
      const loc = useLocation();
      useEffect(() => {
        location = loc;
      });
      return null;
    }
    const initial =
      "/?from=2026-04-15T00:00:00.000Z&to=2026-05-15T23:59:59.999Z&preset=last-n&n=30&u=day&g=day";
    const { result } = renderHook(() => useDateRangeUrlState(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[initial]}>
          <Spy />
          {children}
        </MemoryRouter>
      ),
    });

    const today = todayRange(new Date("2026-05-15T14:30:00Z"));
    act(() => {
      result.current.setRange(today);
    });

    await waitFor(() => {
      expect(location?.search).not.toContain("n=30");
      expect(location?.search).not.toContain("u=day");
    });
  });

  it("round-trips a last-N range", async () => {
    let location: ReturnType<typeof useLocation> | null = null;
    function Spy() {
      const loc = useLocation();
      useEffect(() => {
        location = loc;
      });
      return null;
    }
    const { result } = renderHook(() => useDateRangeUrlState(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={["/"]}>
          <Spy />
          {children}
        </MemoryRouter>
      ),
    });
    const r = lastNRange(7, "day", new Date("2026-05-15T14:30:00Z"), false);
    act(() => {
      result.current.setRange(r);
    });
    await waitFor(() => {
      expect(location?.search).toContain("preset=last-n");
      expect(location?.search).toContain("n=7");
      expect(location?.search).toContain("u=day");
    });
  });
});
