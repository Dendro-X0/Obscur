import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearNativeSessionPersistError,
  NATIVE_SESSION_PERSIST_FAILED_EVENT,
  NATIVE_SESSION_PERSIST_SUCCEEDED_EVENT,
  readLastNativeSessionPersistError,
  reportNativeSessionPersistFailure,
  reportNativeSessionPersistSuccess,
} from "./native-session-persist-feedback";

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

vi.mock("@dweb/ui-kit", () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { logAppEvent } from "@/app/shared/log-app-event";
import { toast } from "@dweb/ui-kit";

describe("native-session-persist-feedback", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  it("records and logs persist failures", async () => {
    reportNativeSessionPersistFailure({
      profileId: "default",
      context: "unlock",
      error: new Error("keychain denied"),
    });

    expect(readLastNativeSessionPersistError("default")).toMatchObject({
      message: "keychain denied",
      context: "unlock",
    });
    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: NATIVE_SESSION_PERSIST_FAILED_EVENT,
      level: "error",
    }));
    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
  });

  it("clears stored errors on successful persist", () => {
    reportNativeSessionPersistFailure({
      profileId: "default",
      context: "unlock",
      error: new Error("temporary"),
    });
    reportNativeSessionPersistSuccess({
      profileId: "default",
      context: "unlock",
    });

    expect(readLastNativeSessionPersistError("default")).toBeNull();
    expect(logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: NATIVE_SESSION_PERSIST_SUCCEEDED_EVENT,
      level: "info",
    }));
  });

  it("clears stored errors explicitly", () => {
    reportNativeSessionPersistFailure({
      profileId: "default",
      context: "import",
      error: "failed",
    });
    clearNativeSessionPersistError("default");
    expect(readLastNativeSessionPersistError("default")).toBeNull();
  });
});
