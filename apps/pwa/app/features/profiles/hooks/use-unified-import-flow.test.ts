import { describe, expect, it } from "vitest";
import { resolveUnifiedImportPreflightPresentation } from "./use-unified-import-flow";

describe("resolveUnifiedImportPreflightPresentation", () => {
  it("defaults to inline on auth surfaces without an active public key", () => {
    expect(resolveUnifiedImportPreflightPresentation({
      publicKeyHex: null,
    })).toBe("inline");
  });

  it("defaults to dialog after unlock when a public key is active", () => {
    expect(resolveUnifiedImportPreflightPresentation({
      publicKeyHex: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" as never,
    })).toBe("dialog");
  });

  it("honors an explicit presentation override", () => {
    expect(resolveUnifiedImportPreflightPresentation({
      publicKeyHex: null,
      preflightPresentation: "dialog",
    })).toBe("dialog");
  });
});
