import { beforeEach, describe, expect, it, vi } from "vitest";

const hostMocks = vi.hoisted(() => ({
  registerNativeBackgroundService: vi.fn(),
}));

vi.mock("@/app/features/runtime/native-host-adapter", () => ({
  registerNativeBackgroundService: hostMocks.registerNativeBackgroundService,
}));

import { initBackgroundService } from "./background-service";

describe("background-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers native background service when available", async () => {
    hostMocks.registerNativeBackgroundService.mockResolvedValue(true);
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    await initBackgroundService();

    expect(hostMocks.registerNativeBackgroundService).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith("[BackgroundService] Registered successfully.");
  });

  it("logs warning when background service is unavailable", async () => {
    hostMocks.registerNativeBackgroundService.mockResolvedValue(false);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await initBackgroundService();

    expect(warnSpy).toHaveBeenCalledWith("[BackgroundService] Not available in this environment.");
  });
});
