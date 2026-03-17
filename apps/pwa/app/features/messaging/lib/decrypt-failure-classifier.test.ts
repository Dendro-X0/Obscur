import { describe, expect, it } from "vitest";
import { classifyDecryptFailure } from "./decrypt-failure-classifier";

describe("classifyDecryptFailure", () => {
  it("classifies unpad errors as expected and non-user-facing", () => {
    const result = classifyDecryptFailure(new Error("Unpad Error"));
    expect(result.reason).toBe("expected_foreign_or_malformed");
    expect(result.runtimeClass).toBe("expected");
    expect(result.shouldSurfaceToUser).toBe(false);
  });

  it("classifies relay scope mismatch as degraded", () => {
    const result = classifyDecryptFailure(new Error("relay_scope_mismatch from remote relay"));
    expect(result.reason).toBe("relay_scope_mismatch");
    expect(result.runtimeClass).toBe("degraded");
    expect(result.shouldSurfaceToUser).toBe(false);
  });

  it("classifies unknown crypto failures as actionable", () => {
    const result = classifyDecryptFailure(new Error("native crypto panic"));
    expect(result.reason).toBe("regression");
    expect(result.runtimeClass).toBe("actionable");
    expect(result.shouldSurfaceToUser).toBe(true);
  });

  it("classifies mixed-wire payload/version failures as expected", () => {
    const result = classifyDecryptFailure(new Error("Version not found in payload"));
    expect(result.reason).toBe("expected_foreign_or_malformed");
    expect(result.runtimeClass).toBe("expected");
    expect(result.shouldSurfaceToUser).toBe(false);
  });

  it("classifies malformed base64/json payload failures as expected", () => {
    const result = classifyDecryptFailure(new Error("Error while decoding from base64: Invalid input length"));
    expect(result.reason).toBe("expected_foreign_or_malformed");
    expect(result.runtimeClass).toBe("expected");
    expect(result.shouldSurfaceToUser).toBe(false);
  });
});
