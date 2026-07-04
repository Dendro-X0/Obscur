import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUTH_ENGINE_METHODS,
  WORKSPACE_ENGINE_METHODS,
  buildAuthGetBootSnapshotRequest,
  buildWorkspaceListGroupsRequest,
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

  it("rust engine_invoke dispatches workspace listGroups via libobscur", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/libobscur/src/engine_invoke.rs"),
      "utf8",
    );
    expect(source).toContain("dispatch_workspace");
    expect(source).toContain("\"listGroups\"");
  });

  it("engine packages do not import apps/pwa", () => {
    for (const pkg of ["obscur-workspace-engine", "obscur-auth-engine"] as const) {
      const index = readFileSync(join(REPO_ROOT, `packages/${pkg}/src/index.ts`), "utf8");
      expect(index).not.toMatch(/apps\/pwa/);
    }
  });
});
