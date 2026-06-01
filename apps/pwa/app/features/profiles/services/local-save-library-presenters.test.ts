import { describe, expect, it } from "vitest";
import type { LocalSaveLibraryEntry } from "./local-save-contracts";
import {
  formatPublicKeyAbbreviation,
  resolveLocalSaveDisplayName,
  resolveLocalSaveTypeLabel,
} from "./local-save-library-presenters";

const entry = (overrides: Partial<LocalSaveLibraryEntry> = {}): LocalSaveLibraryEntry => ({
  saveId: "save-1",
  absolutePath: "/tmp/save.json",
  payloadAbsolutePath: "/tmp/save.json",
  fileName: "obscur-portable-account-deadbeef-2026.json",
  publicKeyHex: "deadbeef".repeat(8) as LocalSaveLibraryEntry["publicKeyHex"],
  exportedAtUnixMs: 1_700_000_000_000,
  payloadKind: "portable_account_bundle",
  payloadFormat: "obscur.portable_account_bundle.v1",
  payloadBytes: 12_000,
  modifiedAtUnixMs: 1_700_000_100_000,
  scanRoot: "/tmp/workspace-exports",
  discovery: "payload_header",
  ...overrides,
});

describe("local-save-library-presenters", () => {
  it("formats public key abbreviation", () => {
    expect(formatPublicKeyAbbreviation("abcd1234".repeat(8))).toBe("abcd1234…1234");
  });

  it("prefers profile label for display name", () => {
    expect(resolveLocalSaveDisplayName(entry({ profileLabel: "Satoshi" }))).toBe("Satoshi");
  });

  it("labels portable account saves", () => {
    expect(resolveLocalSaveTypeLabel(entry())).toBe("Portable account");
  });
});
