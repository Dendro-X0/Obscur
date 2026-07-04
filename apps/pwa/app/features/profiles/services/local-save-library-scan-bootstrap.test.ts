import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { LocalSaveLibraryEntry, LocalSaveLibraryScanResult } from "./local-save-contracts";
import { mergeLocalSaveLibraryScanResults } from "./local-save-library-service";

const PK = "a".repeat(64) as PublicKeyHex;

const makeEntry = (
  payloadPath: string,
  modifiedAtUnixMs: number,
): LocalSaveLibraryEntry => ({
  saveId: `save-${payloadPath}`,
  absolutePath: `${payloadPath}.sidecar.json`,
  payloadAbsolutePath: payloadPath,
  fileName: "save.json",
  publicKeyHex: PK,
  exportedAtUnixMs: modifiedAtUnixMs,
  payloadKind: "unified_account_export",
  payloadFormat: "obscur.unified_account_export.v1",
  payloadBytes: 100,
  modifiedAtUnixMs,
  scanRoot: "/data",
  discovery: "sidecar",
});

const makeResult = (
  entries: ReadonlyArray<LocalSaveLibraryEntry>,
): LocalSaveLibraryScanResult => ({
  scannedAtUnixMs: 1,
  roots: ["/data"],
  entries,
  truncated: false,
  durationMs: 10,
});

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(() => true),
}));

vi.mock("./desktop-window-boot-payload", () => ({
  readDesktopWindowBootPayload: vi.fn(() => ({
    windowLabel: "profile-slot-b",
    profileId: "slot-b",
    launchMode: "new_window" as const,
  })),
}));

vi.mock("./local-save-scan-roots", () => ({
  getSaveLibraryContext: vi.fn(async () => ({
    dataRootPath: "/data",
    exportsFolderPath: "/data/exports",
    profileArchivesFolderPath: "/data/archives",
    scanRoots: ["/data", "/downloads"],
  })),
  buildPrioritySaveLibraryScanRoots: vi.fn((context: { dataRootPath: string } | null) => (
    context ? [context.dataRootPath] : []
  )),
  buildDefaultSaveLibraryScanRoots: vi.fn(async () => ["/data", "/downloads"]),
}));

const scanAtRoots = vi.fn();
const clearCache = vi.fn();

vi.mock("./local-save-library-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./local-save-library-service")>();
  return {
    ...actual,
    scanLocalSaveLibraryAtRoots: (...args: unknown[]) => scanAtRoots(...args),
    clearLocalSaveLibraryScanCache: () => clearCache(),
  };
});

describe("mergeLocalSaveLibraryScanResults", () => {
  it("dedupes by payload path and keeps the newer modified time", () => {
    const fast = makeResult([
      makeEntry("/data/save-a.json", 100),
      makeEntry("/data/save-b.json", 50),
    ]);
    const deep = makeResult([
      makeEntry("/data/save-a.json", 200),
      makeEntry("/downloads/save-c.json", 75),
    ]);
    const merged = mergeLocalSaveLibraryScanResults(fast, deep);
    expect(merged.entries.map((entry) => entry.payloadAbsolutePath).sort()).toEqual([
      "/data/save-a.json",
      "/data/save-b.json",
      "/downloads/save-c.json",
    ]);
    expect(merged.entries.find((entry) => entry.payloadAbsolutePath === "/data/save-a.json")?.modifiedAtUnixMs).toBe(200);
  });
});

describe("startLocalSaveLibraryWindowBootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    scanAtRoots.mockReset();
    clearCache.mockReset();
    sessionStorage.clear();
  });

  afterEach(async () => {
    const mod = await import("./local-save-library-scan-bootstrap");
    mod.localSaveLibraryScanBootstrapInternals.resetBootstrapStateForTests();
  });

  it("runs fast then deep scan and clears cache for new windows", async () => {
    scanAtRoots
      .mockResolvedValueOnce(makeResult([makeEntry("/data/fast.json", 10)]))
      .mockResolvedValueOnce(makeResult([
        makeEntry("/data/fast.json", 20),
        makeEntry("/downloads/deep.json", 30),
      ]));

    const mod = await import("./local-save-library-scan-bootstrap");
    mod.localSaveLibraryScanBootstrapInternals.resetBootstrapStateForTests();
    await mod.startLocalSaveLibraryWindowBootstrap();

    expect(clearCache).toHaveBeenCalledTimes(1);
    expect(scanAtRoots).toHaveBeenCalledTimes(2);
    expect(scanAtRoots.mock.calls[0]?.[1]).toMatchObject({ maxDepth: 2, maxResults: 96 });
    expect(scanAtRoots.mock.calls[1]?.[1]).toMatchObject({ maxDepth: 5, maxResults: 240, force: true });

    const state = mod.getLocalSaveLibraryScanBootstrapState();
    expect(state.phase).toBe("complete");
    expect(state.result?.entries.map((entry) => entry.payloadAbsolutePath).sort()).toEqual([
      "/data/fast.json",
      "/downloads/deep.json",
    ]);
  });
});
