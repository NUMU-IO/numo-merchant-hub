import "@testing-library/jest-dom";
import { vi } from "vitest";

vi.stubEnv("VITE_API_URL", "http://localhost/api/v1");

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
