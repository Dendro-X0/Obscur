import { describe, expect, it } from "vitest";
import type { PortabilityImportPreflight } from "./portability-import-preflight";
import type { PendingProfileImport } from "./pending-profile-import-service";
import { shouldAutoApplyStagedImportOnUnlock } from "./staged-import-auto-apply-policy";

const PK = "87cb2c20012587cb2c20012587cb2c20012587cb2c20012587cb2c20012587cb2c20" as const;

const pending: PendingProfileImport = {
  profileId: "default",
  fileName: "export.json",
  rawJson: "{}",
  bundlePublicKeyHex: PK,
  savedAtUnixMs: Date.now(),
};

const canProceedPreflight = {
  canProceed: true,
  canStageForSignIn: false,
} as PortabilityImportPreflight;

describe("shouldAutoApplyStagedImportOnUnlock", () => {
  it("auto-applies when staged backup matches unlocked account and preflight can proceed", () => {
    expect(shouldAutoApplyStagedImportOnUnlock({
      pending,
      activePublicKeyHex: PK,
      preflight: canProceedPreflight,
      autoResumeOnUnlock: true,
    })).toBe(true);
  });

  it("does not auto-apply when preflight still requires sign-in", () => {
    expect(shouldAutoApplyStagedImportOnUnlock({
      pending,
      activePublicKeyHex: PK,
      preflight: { ...canProceedPreflight, canProceed: false },
      autoResumeOnUnlock: true,
    })).toBe(false);
  });

  it("does not auto-apply when staged account mismatches active account", () => {
    expect(shouldAutoApplyStagedImportOnUnlock({
      pending,
      activePublicKeyHex: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      preflight: canProceedPreflight,
      autoResumeOnUnlock: true,
    })).toBe(false);
  });

  it("does not auto-apply for manual settings import surfaces", () => {
    expect(shouldAutoApplyStagedImportOnUnlock({
      pending,
      activePublicKeyHex: PK,
      preflight: canProceedPreflight,
      autoResumeOnUnlock: false,
    })).toBe(false);
  });
});
