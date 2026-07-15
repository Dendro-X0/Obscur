import { describe, expect, it } from "vitest";
import {
  buildVaultBlobSyntheticUrl,
  isVaultBlobSyntheticUrl,
  isVaultStandaloneCatalogUrl,
} from "./vault-disk-inventory";

describe("vault-disk-inventory", () => {
  it("builds stable synthetic URLs from opaque vault blob names", () => {
    expect(buildVaultBlobSyntheticUrl("abc123def456789012345678.obscurvault")).toBe(
      "obscur://vault/blob/abc123def456789012345678",
    );
  });

  it("classifies standalone catalog URLs", () => {
    expect(isVaultBlobSyntheticUrl("obscur://vault/blob/abc123")).toBe(true);
    expect(isVaultStandaloneCatalogUrl("obscur://vault/local/deadbeef")).toBe(true);
    expect(isVaultStandaloneCatalogUrl("https://cdn.example.com/a.jpg")).toBe(false);
  });
});
