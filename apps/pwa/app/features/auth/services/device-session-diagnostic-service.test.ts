import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { resolveDeviceSessionDiagnostic } from "./device-session-diagnostic-service";
import { getRememberMeStorageKey } from "@/app/features/auth/utils/auth-storage-keys";

const nativeRuntime = vi.hoisted(() => ({
  isNative: true,
}));

const sessionStatus = vi.hoisted(() => ({
  isActive: false,
  npub: null as string | null,
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: () => nativeRuntime.isNative,
}));

vi.mock("@/app/features/auth/services/session-api", () => ({
  SessionApi: {
    getSessionStatus: vi.fn(async () => ({
      isActive: sessionStatus.isActive,
      npub: sessionStatus.npub,
      isNative: true,
    })),
  },
}));

describe("device-session-diagnostic-service", () => {
  const storedPublicKeyHex = "11".repeat(32) as PublicKeyHex;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    nativeRuntime.isNative = true;
    sessionStatus.isActive = false;
    sessionStatus.npub = null;
    localStorage.setItem(getRememberMeStorageKey("default"), "true");
  });

  it("reports unavailable on non-native runtimes", async () => {
    nativeRuntime.isNative = false;
    const snapshot = await resolveDeviceSessionDiagnostic({
      profileId: "default",
      storedPublicKeyHex,
    });
    expect(snapshot.status).toBe("unavailable");
    expect(snapshot.usesNativeSecureStore).toBe(false);
  });

  it("reports off when stay signed in is disabled", async () => {
    localStorage.setItem(getRememberMeStorageKey("default"), "false");
    const snapshot = await resolveDeviceSessionDiagnostic({
      profileId: "default",
      storedPublicKeyHex,
    });
    expect(snapshot.status).toBe("off");
    expect(snapshot.staySignedInEnabled).toBe(false);
  });

  it("reports active when keychain matches and session is in memory", async () => {
    sessionStatus.isActive = true;
    sessionStatus.npub = storedPublicKeyHex;
    const snapshot = await resolveDeviceSessionDiagnostic({
      profileId: "default",
      storedPublicKeyHex,
    });
    expect(snapshot.status).toBe("active");
    expect(snapshot.identityMatch).toBe("ok");
    expect(snapshot.inMemorySessionActive).toBe(true);
  });

  it("reports ready when keychain is present but session is locked in memory", async () => {
    sessionStatus.npub = storedPublicKeyHex;
    const snapshot = await resolveDeviceSessionDiagnostic({
      profileId: "default",
      storedPublicKeyHex,
    });
    expect(snapshot.status).toBe("ready");
    expect(snapshot.inMemorySessionActive).toBe(false);
  });

  it("reports mismatch when keychain belongs to another account", async () => {
    sessionStatus.npub = "22".repeat(32);
    const snapshot = await resolveDeviceSessionDiagnostic({
      profileId: "default",
      storedPublicKeyHex,
    });
    expect(snapshot.status).toBe("mismatch");
    expect(snapshot.identityMatch).toBe("mismatch");
  });

  it("reports persist_error when stay signed in is on but last persist failed", async () => {
    sessionStorage.setItem(
      "obscur_native_session_persist_error::default",
      JSON.stringify({
        message: "keychain write denied",
        context: "unlock",
        atUnixMs: Date.now(),
      }),
    );
    const snapshot = await resolveDeviceSessionDiagnostic({
      profileId: "default",
      storedPublicKeyHex,
    });
    expect(snapshot.status).toBe("persist_error");
    expect(snapshot.lastPersistError).toBe("keychain write denied");
  });

  it("reports keychain_missing when stay signed in is on and no keychain entry exists", async () => {
    const snapshot = await resolveDeviceSessionDiagnostic({
      profileId: "default",
      storedPublicKeyHex,
    });
    expect(snapshot.status).toBe("keychain_missing");
  });
});
