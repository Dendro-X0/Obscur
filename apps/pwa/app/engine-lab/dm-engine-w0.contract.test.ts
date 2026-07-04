import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DM_ENGINE_METHODS,
  buildDmGetThreadRequest,
  buildDmListConversationsRequest,
  validateEngineInvokeRequest,
} from "@obscur/engine-contracts";

const REPO_ROOT = join(__dirname, "../../../../");

describe("dm-engine w0 — method catalog", () => {
  it("defines canonical dm methods", () => {
    expect(DM_ENGINE_METHODS.getThread).toBe("getThread");
    expect(DM_ENGINE_METHODS.listConversations).toBe("listConversations");
  });

  it("builds typed getThread invoke requests", () => {
    const request = buildDmGetThreadRequest({
      profileId: "default",
      payload: { conversationId: "dm:aa:bb", limit: 50 },
    });
    expect(request.engine).toBe("dm");
    expect(request.method).toBe("getThread");
    expect(request.scope.profileId).toBe("default");
    expect(request.payload).toEqual({ conversationId: "dm:aa:bb", limit: 50 });
    expect(validateEngineInvokeRequest(request)).toBeNull();
  });

  it("rejects getThread without conversationId", () => {
    const request = buildDmGetThreadRequest({
      profileId: "default",
      payload: { conversationId: "  " },
    });
    expect(validateEngineInvokeRequest(request)?.code).toBe("invalid_payload");
  });

  it("builds listConversations invoke requests", () => {
    const request = buildDmListConversationsRequest({ profileId: "default" });
    expect(request.engine).toBe("dm");
    expect(request.method).toBe("listConversations");
    expect(validateEngineInvokeRequest(request)).toBeNull();
  });
});

describe("dm-engine w0 — host boundary wiring", () => {
  it("dm-kernel thread port routes strict reads through dm-engine", () => {
    const source = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/dm-kernel/dm-kernel-thread-port.ts"),
      "utf8",
    );
    expect(source).toContain("fetchDmThreadRows");
    expect(source).toContain("isEngineLabStrictMode");
    expect(source).toContain("createTauriEngineHost");
  });

  it("tauri engine host invokes engine_invoke command", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/obscur-engine-host/src/tauri-engine-host.ts"),
      "utf8",
    );
    expect(source).toContain('"engine_invoke"');
  });

  it("rust engine_invoke dispatches dm methods via libobscur", () => {
    const source = readFileSync(
      join(REPO_ROOT, "apps/desktop/src-tauri/src/commands/engine.rs"),
      "utf8",
    );
    expect(source).toContain("engine_invoke");
    expect(source).toContain("libobscur::engine_invoke::{dispatch");
    expect(source).toContain("dispatch(db, &request)");
    const core = readFileSync(
      join(REPO_ROOT, "packages/libobscur/src/engine_invoke.rs"),
      "utf8",
    );
    expect(core).toContain("\"getThread\"");
    expect(core).toContain("\"listConversations\"");
  });
});
