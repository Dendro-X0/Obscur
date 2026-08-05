import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTH_ENGINE_METHODS,
  WORKSPACE_ENGINE_METHODS,
  buildAuthGetBootSnapshotRequest,
  buildWorkspaceInsertGroupMessageRequest,
  buildWorkspaceListGroupMessagesRequest,
  buildWorkspaceListGroupsRequest,
  buildWorkspaceUpsertGroupRequest,
  validateEngineInvokeRequest,
} from "@obscur/engine-contracts";

const REPO_ROOT = join(__dirname, "../../../../");

describe("engine-b4 w0 — method catalogs", () => {
  it("defines workspace listGroups invoke request", () => {
    const request = buildWorkspaceListGroupsRequest({ profileId: "default" });
    expect(request.engine).toBe("workspace");
    expect(request.method).toBe(WORKSPACE_ENGINE_METHODS.listGroups);
    expect(validateEngineInvokeRequest(request)).toBeNull();
  });

  it("defines workspace upsertGroup invoke request", () => {
    const request = buildWorkspaceUpsertGroupRequest({
      profileId: "default",
      group: {
        id: "g1",
        profile_id: "default",
        name: "Test",
        relay_url: "wss://relay.test",
        kind: "invite-only",
        joined_at: 1,
      },
    });
    expect(request.engine).toBe("workspace");
    expect(request.method).toBe(WORKSPACE_ENGINE_METHODS.upsertGroup);
    expect(validateEngineInvokeRequest(request)).toBeNull();
  });

  it("defines workspace listGroupMessages + insertGroupMessage invoke requests", () => {
    const list = buildWorkspaceListGroupMessagesRequest({
      profileId: "default",
      payload: { groupId: "g1", limit: 50 },
    });
    expect(list.method).toBe(WORKSPACE_ENGINE_METHODS.listGroupMessages);
    expect(validateEngineInvokeRequest(list)).toBeNull();

    const insert = buildWorkspaceInsertGroupMessageRequest({
      profileId: "default",
      message: {
        event_id: "e1",
        group_id: "g1",
        profile_id: "default",
        sender_pubkey: "aa",
        plaintext: "hi",
        created_at: 1,
        received_at: 1,
      },
    });
    expect(insert.method).toBe(WORKSPACE_ENGINE_METHODS.insertGroupMessage);
    expect(validateEngineInvokeRequest(insert)).toBeNull();
  });

  it("defines auth getBootSnapshot catalog entry", () => {
    const request = buildAuthGetBootSnapshotRequest({
      profileId: "default",
      payload: { restoreEligible: true },
    });
    expect(request.engine).toBe("auth");
    expect(request.method).toBe(AUTH_ENGINE_METHODS.getBootSnapshot);
    expect(validateEngineInvokeRequest(request)).toBeNull();
  });
});

describe("engine-b4 w0 — kernel delegates to packages", () => {
  it("workspace roster port uses @obscur/workspace-engine", () => {
    const source = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/workspace-kernel/workspace-kernel-roster-port.ts"),
      "utf8",
    );
    expect(source).toContain("@obscur/workspace-engine");
    expect(source).toContain("buildWorkspaceRosterProjection");
    expect(source).not.toContain("use-sealed-community");
  });

  it("auth-kernel ports assemble via @obscur/auth-engine", () => {
    const source = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/auth-kernel/auth-kernel-ports.ts"),
      "utf8",
    );
    expect(source).toContain("createAuthEnginePorts");
    expect(source).toContain("@obscur/auth-engine");
  });

  it("auth-kernel policy delegates authority to auth-engine", () => {
    const source = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/auth-kernel/auth-kernel-policy.ts"),
      "utf8",
    );
    expect(source).toContain("isAuthEngineAuthority");
  });

  it("rust engine_invoke dispatches workspace listGroups + upsertGroup + message methods via libobscur", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/libobscur/src/engine_invoke.rs"),
      "utf8",
    );
    expect(source).toContain("dispatch_workspace");
    expect(source).toContain("\"listGroups\"");
    expect(source).toContain("\"upsertGroup\"");
    expect(source).toContain("\"listGroupMessages\"");
    expect(source).toContain("\"insertGroupMessage\"");
    expect(source).toContain("\"insertGroupTombstone\"");
  });

  it("engine packages do not import apps/pwa", () => {
    for (const pkg of ["obscur-workspace-engine", "obscur-auth-engine"] as const) {
      const index = readFileSync(join(REPO_ROOT, `packages/${pkg}/src/index.ts`), "utf8");
      expect(index).not.toMatch(/apps\/pwa/);
    }
  });
});
