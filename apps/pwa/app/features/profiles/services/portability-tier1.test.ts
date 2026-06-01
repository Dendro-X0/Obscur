import { describe, expect, it, beforeEach } from "vitest";
import {
  buildPortableAccountExportFileName,
  buildUnifiedAccountExportFileName,
  buildWorkspaceBundleExportFileName,
  loadPortabilityExportNamingPreset,
  savePortabilityExportNamingPreset,
} from "./portability-export-naming";
import {
  getLatestPortabilityExport,
  recordPortabilityExport,
} from "./portability-export-history";

describe("portability export naming", () => {
  it("builds portable account filenames for each preset", () => {
    const exportedAtUnixMs = 1_700_000_000_000;
    expect(buildPortableAccountExportFileName({
      publicKeyHex: "abcdef0123456789".padEnd(64, "0"),
      exportedAtUnixMs,
      preset: "pubkey_prefix_date",
    })).toContain("obscur-portable-account-abcdef01-");
    expect(buildPortableAccountExportFileName({
      publicKeyHex: "abcdef0123456789".padEnd(64, "0"),
      profileLabel: "Work Window",
      exportedAtUnixMs,
      preset: "profile_label_date",
    })).toContain("Work-Window-portable-");
    expect(buildPortableAccountExportFileName({
      publicKeyHex: "abcdef0123456789".padEnd(64, "0"),
      exportedAtUnixMs,
      preset: "timestamp_only",
    })).toBe(`obscur-export-${exportedAtUnixMs}.json`);
  });

  it("builds unified account export filenames", () => {
    const exportedAtUnixMs = 1_700_000_000_000;
    expect(buildUnifiedAccountExportFileName({
      publicKeyHex: "abcdef0123456789".padEnd(64, "0"),
      exportedAtUnixMs,
      preset: "pubkey_prefix_date",
    })).toContain("obscur-account-export-abcdef01-");
    expect(buildUnifiedAccountExportFileName({
      publicKeyHex: "abcdef0123456789".padEnd(64, "0"),
      profileLabel: "Tester 2",
      exportedAtUnixMs,
      preset: "profile_label_date",
    })).toContain("Tester-2-account-export-");
  });

  it("builds workspace bundle filenames for each preset", () => {
    const exportedAtUnixMs = 1_700_000_000_000;
    expect(buildWorkspaceBundleExportFileName({
      profileId: "default",
      profileLabel: "Tester 1",
      exportedAtUnixMs,
      preset: "profile_label_date",
    })).toContain("Tester-1-workspace-");
    expect(buildWorkspaceBundleExportFileName({
      profileId: "default",
      exportedAtUnixMs,
      preset: "timestamp_only",
    })).toBe(`obscur-export-${exportedAtUnixMs}.obscur-bundle`);
  });

  it("persists naming preset per profile scope", () => {
    savePortabilityExportNamingPreset("profile_label_date", "work");
    expect(loadPortabilityExportNamingPreset("work")).toBe("profile_label_date");
  });
});

describe("portability export history", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("records and reads the latest export", () => {
    recordPortabilityExport({
      kind: "workspace_bundle",
      fileName: "test.obscur-bundle",
      absolutePath: "C:\\exports\\test.obscur-bundle",
      exportedAtUnixMs: 100,
      estimatedSizeBytes: 2048,
      label: "Encrypted workspace bundle exported",
    }, "default");
    const latest = getLatestPortabilityExport(undefined, "default");
    expect(latest?.fileName).toBe("test.obscur-bundle");
    expect(latest?.estimatedSizeBytes).toBe(2048);
  });
});
