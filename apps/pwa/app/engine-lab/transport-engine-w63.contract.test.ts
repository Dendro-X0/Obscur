import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  shouldRouteSubtractedStandalonePublishPort,
} from "@/app/features/transport-kernel/transport-kernel-publish-port";
import {
  STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF,
  STANDALONE_LEGACY_FILES_TO_DELETE,
  STANDALONE_LEGACY_PORT_PATHS_TO_UPDATE,
} from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-subtraction-manifest";
import { parseSmokeSignOffDecision } from "@/app/features/transport-kernel/transport-kernel-standalone-deletion-gate";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w63 — standalone legacy port swap rehearsal", () => {
  it("pins port swap rehearsal charter with delegation policy", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w63-standalone-legacy-port-swap-rehearsal.md",
    );
    expect(charter).toContain("Port Swap Rehearsal");
    expect(charter).toContain("shouldRouteSubtractedStandalonePublishPort");
    expect(charter).toContain("execute-transport-standalone-legacy-subtraction.mjs");
  });

  it("implements subtracted port delegation policy in publish-port", () => {
    const policy = readFileSync(
      join(PWA_ROOT, "app/features/transport-kernel/transport-kernel-publish-port.ts"),
      "utf8",
    );
    expect(policy).toContain("shouldRouteSubtractedStandalonePublishPort");
  });

  it("wires subtracted module delegation in relay-standalone-publish-port", () => {
    const port = readFileSync(join(PWA_ROOT, STANDALONE_LEGACY_PORT_PATHS_TO_UPDATE[0]!), "utf8");
    expect(port).toContain("relay-standalone-publish-port-subtracted");
    expect(port).toContain("shouldRouteSubtractedStandalonePublishPort");
    expect(port).toContain("transport-kernel-standalone-publish-legacy");
  });

  it("keeps subtracted rehearsal gate off by default", () => {
    expect(parseSmokeSignOffDecision(readFromRepo(STANDALONE_LEGACY_DELETION_RECORDED_SIGN_OFF))).toBe("BLOCKED");
    expect(shouldRouteSubtractedStandalonePublishPort()).toBe(false);
  });

  it("keeps production legacy files on disk while gate is closed", () => {
    for (const relPath of STANDALONE_LEGACY_FILES_TO_DELETE) {
      expect(existsSync(join(PWA_ROOT, relPath))).toBe(true);
    }
  });
});

describe("transport-engine w63 — maintainer subtraction script", () => {
  it("documents blocked subtraction script in repo", () => {
    const script = readFromRepo("scripts/execute-transport-standalone-legacy-subtraction.mjs");
    expect(script).toContain("execute-transport-standalone-legacy-subtraction: BLOCKED");
    expect(script).toContain("NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED");
  });
});
