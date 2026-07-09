/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getTrackedVaultMediaBlobUrlCount,
  registerVaultMediaBlobUrl,
  revokeAllVaultMediaBlobUrls,
  revokeVaultMediaBlobUrl,
} from "./vault-media-blob-lifecycle";

describe("vault-media-blob-lifecycle", () => {
  afterEach(() => {
    revokeAllVaultMediaBlobUrls();
    vi.restoreAllMocks();
  });

  it("tracks blob URLs per remote key and replaces prior preview blobs", () => {
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    const first = registerVaultMediaBlobUrl("vault://item-a", "blob:first");
    const second = registerVaultMediaBlobUrl("vault://item-a", "blob:second");

    expect(first).toBe("blob:first");
    expect(second).toBe("blob:second");
    expect(getTrackedVaultMediaBlobUrlCount()).toBe(1);
    expect(revokeSpy).toHaveBeenCalledWith("blob:first");
  });

  it("revokes a single tracked blob URL", () => {
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    registerVaultMediaBlobUrl("vault://item-b", "blob:preview");

    revokeVaultMediaBlobUrl("vault://item-b");

    expect(revokeSpy).toHaveBeenCalledWith("blob:preview");
    expect(getTrackedVaultMediaBlobUrlCount()).toBe(0);
  });

  it("revokes every tracked blob URL on lock or refresh", () => {
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");
    registerVaultMediaBlobUrl("vault://one", "blob:one");
    registerVaultMediaBlobUrl("vault://two", "blob:two");

    revokeAllVaultMediaBlobUrls();

    expect(revokeSpy).toHaveBeenCalledWith("blob:one");
    expect(revokeSpy).toHaveBeenCalledWith("blob:two");
    expect(getTrackedVaultMediaBlobUrlCount()).toBe(0);
  });
});
