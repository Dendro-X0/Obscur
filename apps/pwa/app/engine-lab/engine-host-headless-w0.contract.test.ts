import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fetchDmThreadRows, listDmConversations } from "@obscur/dm-engine";
import { DM_ENGINE_METHODS } from "@obscur/engine-contracts";
import { createMemoryEngineHost } from "@obscur/engine-host";

const REPO_ROOT = join(__dirname, "../../../../");

describe("engine-host headless w0 — memory port", () => {
  it("exports createMemoryEngineHost from engine-host package", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/obscur-engine-host/src/index.ts"),
      "utf8",
    );
    expect(source).toContain("createMemoryEngineHost");
    expect(source).toContain("memory-engine-host");
  });

  it("memory host does not import Tauri", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/obscur-engine-host/src/memory-engine-host.ts"),
      "utf8",
    );
    expect(source).not.toContain("@tauri-apps");
    expect(source).not.toContain("engine_invoke");
  });

  it("tauri host remains separate from memory host", () => {
    const tauri = readFileSync(
      join(REPO_ROOT, "packages/obscur-engine-host/src/tauri-engine-host.ts"),
      "utf8",
    );
    const memory = readFileSync(
      join(REPO_ROOT, "packages/obscur-engine-host/src/memory-engine-host.ts"),
      "utf8",
    );
    expect(tauri).toContain("engine_invoke");
    expect(memory).not.toContain("engine_invoke");
  });

  it("dm-engine routes through memory host without native invoke", async () => {
    const host = createMemoryEngineHost({
      handlers: {
        dm: async (request) => {
          if (request.method === DM_ENGINE_METHODS.getThread) {
            return { ok: true, data: [{ id: "msg-1", content: "hello" }] };
          }
          if (request.method === DM_ENGINE_METHODS.listConversations) {
            return { ok: true, data: [{ id: "dm:aa:bb", updatedAt: 1 }] };
          }
          return { ok: false, errorCode: "unsupported_method" };
        },
      },
    });

    const rows = await fetchDmThreadRows({
      host,
      profileId: "default",
      payload: { conversationId: "dm:aa:bb", limit: 50 },
    });
    expect(rows).toHaveLength(1);

    const conversations = await listDmConversations({ host, profileId: "default" });
    expect(conversations).toHaveLength(1);
  });

  it("exports createSubprocessEngineHost for libobscur CLI bridge", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/obscur-engine-host/src/index.ts"),
      "utf8",
    );
    expect(source).toContain("createSubprocessEngineHost");
  });

  it("headless CLI binary is declared in libobscur Cargo.toml", () => {
    const cargo = readFileSync(
      join(REPO_ROOT, "packages/libobscur/Cargo.toml"),
      "utf8",
    );
    expect(cargo).toContain("engine-lab-headless");
  });
});
