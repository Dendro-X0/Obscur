import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_BAND, isEngineLabStrictMode } from "./engine-lab-policy";

const PWA_APP = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(PWA_APP, "../../..");

const read = (relFromApp: string): string => (
  readFileSync(path.join(PWA_APP, relFromApp), "utf8")
);

/** Shell surfaces that must not own backend logic — host chrome only. */
const SHELL_SURFACES = [
  "features/main-shell/main-shell.tsx",
  "features/runtime/components/unlocked-app-runtime-shell.tsx",
  "features/profiles/components/app-session-shell.tsx",
  "features/messaging/components/chat-view.tsx",
  "features/messaging/components/composer.tsx",
] as const;

const HYDRATE_LEGACY_TOKENS = [
  "dm-conversation-hydrate-pipeline",
  "runDmConversationHydrateReadModelPipeline",
  "assembleDmHydrateThreadReadModel",
  "dm-read-authority-contract",
] as const;

const RELAY_LEGACY_TOKENS = [
  "relay-recovery-policy",
  "relay-runtime-supervisor",
] as const;

const SEALED_COMMUNITY_LEGACY = [
  "use-sealed-community",
  "useSealedCommunity",
] as const;

describe("engine lab policy", () => {
  it("strict mode is default (legacy opt-in only)", () => {
    expect(isEngineLabStrictMode()).toBe(true);
    expect(ENGINE_LAB_BAND).toBe("ENGINE-LAB");
  });
});

describe("engine lab shell quarantine", () => {
  it("shell surfaces do not import hydrate pipeline owners", () => {
    const offenders: string[] = [];
    for (const surface of SHELL_SURFACES) {
      const source = read(surface);
      for (const token of HYDRATE_LEGACY_TOKENS) {
        if (source.includes(token)) {
          offenders.push(`${surface} → ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("composer and chat-view do not read enhanced-relay-pool directly", () => {
    for (const surface of ["features/messaging/components/composer.tsx", "features/messaging/components/chat-view.tsx"] as const) {
      const source = read(surface);
      expect(source).not.toMatch(/from\s+["'][^"']*enhanced-relay-pool["']/);
    }
  });
});

describe("engine lab provider quarantine", () => {
  it("relay-provider does not export parallel recovery truth to settings (single supervisor owner)", () => {
    const source = read("features/relays/providers/relay-provider.tsx");
    expect(source).toContain("createRelayRuntimeSupervisor");
    expect(source).not.toMatch(/from\s+["'][^"']*use-conversation-messages["']/);
  });

  it("messaging-provider does not import hydrate pipeline", () => {
    const source = read("features/messaging/providers/messaging-provider.tsx");
    for (const token of HYDRATE_LEGACY_TOKENS) {
      expect(source).not.toContain(token);
    }
  });
});

describe("engine lab workspace quarantine", () => {
  it("main-shell uses workspace-kernel roster when kernel authority on", () => {
    const source = read("features/main-shell/main-shell.tsx");
    expect(source).toContain("isWorkspaceKernelAuthority");
  });
});

describe("host-engine boundary package", () => {
  it("engine-contracts package exists and defines HostEnginePort", () => {
    const source = readFileSync(
      path.join(REPO_ROOT, "packages/obscur-engine-contracts/src/host-engine-port.ts"),
      "utf8",
    );
    expect(source).toContain("HostEnginePort");
    expect(source).not.toContain("enhanced-relay-pool");
  });

  it("engine-contracts does not import from apps/", () => {
    const indexSource = readFileSync(
      path.join(REPO_ROOT, "packages/obscur-engine-contracts/src/index.ts"),
      "utf8",
    );
    expect(indexSource).not.toMatch(/from\s+["']@\/app\//);
    expect(indexSource).not.toMatch(/apps\/pwa/);
  });

  it("transport-engine package exists and defines TransportSnapshot", () => {
    const source = readFileSync(
      path.join(REPO_ROOT, "packages/obscur-transport-engine/src/transport-types.ts"),
      "utf8",
    );
    expect(source).toContain("TransportSnapshot");
    expect(source).not.toContain("enhanced-relay-pool");
  });

  it("workspace-engine and auth-engine packages exist", () => {
    const workspace = readFileSync(
      path.join(REPO_ROOT, "packages/obscur-workspace-engine/src/workspace-types.ts"),
      "utf8",
    );
    const auth = readFileSync(
      path.join(REPO_ROOT, "packages/obscur-auth-engine/src/auth-engine-policy.ts"),
      "utf8",
    );
    expect(workspace).toContain("WorkspaceRosterProjection");
    expect(auth).toContain("isAuthEngineAuthority");
  });
});

describe("kernel strict authority under engine lab", () => {
  it("dm-kernel policy references engine lab strict mode", () => {
    const source = read("features/dm-kernel/dm-kernel-policy.ts");
    expect(source).toContain("isEngineLabStrictMode");
  });

  it("workspace-kernel policy references engine lab strict mode", () => {
    const source = read("features/workspace-kernel/workspace-kernel-policy.ts");
    expect(source).toContain("isEngineLabStrictMode");
  });

  it("transport-kernel policy references engine lab strict mode", () => {
    const source = read("features/transport-kernel/transport-kernel-policy.ts");
    expect(source).toContain("isEngineLabStrictMode");
    expect(source).toContain("isTransportKernelAuthority");
  });
});
