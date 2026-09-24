import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/services/api";

import { ApiError } from "../api-error";

const envelope = {
  success: false,
  error: {
    code: "FEATURE_NOT_AVAILABLE",
    message: "Your plan does not include custom_domain.",
    details: {
      feature: "custom_domain",
      reason: "not_in_plan",
      upgrade_required: true,
      available_via: ["starter", "pro"],
    },
  },
};

describe("ApiError.code / details", () => {
  it("reads error.code and error.details from the API's envelope", () => {
    const err = new ApiError(403, envelope.error.message, null, envelope);
    expect(err.code).toBe("FEATURE_NOT_AVAILABLE");
    expect(err.details).toEqual(envelope.error.details);
  });

  it("is null when the body is not the envelope", () => {
    expect(new ApiError(403, "Not enough permissions", null, { detail: "Not enough permissions" }).code).toBeNull();
    expect(new ApiError(0, null).code).toBeNull();
    expect(new ApiError(0, null).details).toBeNull();
    // VALIDATION_ERROR details are a list of fields, not an object.
    const invalid = { error: { code: "VALIDATION_ERROR", details: [{ field: "name" }] } };
    expect(new ApiError(422, null, null, invalid).details).toBeNull();
  });
});

describe("apiClient on a non-CSRF 403", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the body, so the error code reaches the UI", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(envelope), { status: 403 }),
    );

    const err = await apiClient("/stores/s1/domains").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(403);
    expect((err as ApiError).code).toBe("FEATURE_NOT_AVAILABLE");
    expect((err as ApiError).details).toEqual(envelope.error.details);
    expect((err as ApiError).serverDetail).toBe(envelope.error.message);
  });
});
