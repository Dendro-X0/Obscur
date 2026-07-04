import { describe, expect, it, vi } from "vitest";

describe("resolveAtRestEncryptionUiPolicy", () => {
  it("shows queue toggle on web and desktop notice on native", async () => {
    vi.resetModules();
    vi.doMock("@/app/features/runtime/runtime-capabilities", () => ({
      hasNativeRuntime: () => false,
    }));
    const web = await import("./storage-at-rest-ui-policy");
    expect(web.resolveAtRestEncryptionUiPolicy()).toEqual({
      showOutboundQueueEncryptionToggle: true,
      desktopAtRestEncryptionActive: false,
    });

    vi.resetModules();
    vi.doMock("@/app/features/runtime/runtime-capabilities", () => ({
      hasNativeRuntime: () => true,
    }));
    const native = await import("./storage-at-rest-ui-policy");
    expect(native.resolveAtRestEncryptionUiPolicy()).toEqual({
      showOutboundQueueEncryptionToggle: false,
      desktopAtRestEncryptionActive: true,
    });
  });
});
