import { describe, expect, it } from "vitest";
import { buildObscurLocalSaveSidecar, parseObscurLocalSaveSidecar } from "./local-save-sidecar";
import { OBSCUR_LOCAL_SAVE_FORMAT } from "./local-save-contracts";

const PK = "a".repeat(64);

describe("local-save-sidecar", () => {
  it("round-trips sidecar metadata", () => {
    const sidecar = buildObscurLocalSaveSidecar({
      saveId: "save-1",
      publicKeyHex: PK as never,
      profileLabel: "Profile 2",
      exportedAtUnixMs: 1_700_000_000_000,
      payloadFileName: "obscur-account-export-abcdef01-2026.obscur-account-export.json",
      payloadKind: "unified_account_export",
      payloadFormat: "obscur.unified_account_export.v1",
      payloadBytes: 4096,
    });
    const parsed = parseObscurLocalSaveSidecar(sidecar);
    expect(parsed?.format).toBe(OBSCUR_LOCAL_SAVE_FORMAT);
    expect(parsed?.publicKeyHex).toBe(PK);
    expect(parsed?.profileLabel).toBe("Profile 2");
  });
});
