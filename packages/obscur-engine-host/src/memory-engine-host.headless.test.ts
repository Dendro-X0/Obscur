import { describe, expect, it } from "vitest";
import { DM_ENGINE_METHODS } from "@obscur/engine-contracts";
import { createMemoryEngineHost } from "./memory-engine-host";

describe("memory-engine-host headless", () => {
  it("invokes registered dm handler without Tauri", async () => {
    const host = createMemoryEngineHost({
      handlers: {
        dm: async (request) => {
          if (request.method === DM_ENGINE_METHODS.getThread) {
            return { ok: true, data: [{ id: "msg-1" }] };
          }
          return { ok: false, errorCode: "unsupported_method" };
        },
      },
    });

    const result = await host.invoke({
      engine: "dm",
      method: DM_ENGINE_METHODS.getThread,
      scope: { profileId: "default" },
      payload: { conversationId: "dm:aa:bb", limit: 50 },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it("fails closed when no handler is registered", async () => {
    const host = createMemoryEngineHost();
    const result = await host.invoke({
      engine: "dm",
      method: DM_ENGINE_METHODS.getThread,
      scope: { profileId: "default" },
      payload: { conversationId: "dm:aa:bb", limit: 50 },
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("unsupported_engine");
  });
});
