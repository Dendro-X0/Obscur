import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("private-trust-local-setup SEC-R3 contract", () => {
  const pwaRoot = path.resolve(__dirname, "../../../..");
  const repoRoot = path.resolve(pwaRoot, "..", "..");
  const docPath = path.join(repoRoot, "docs/assets/demo/private-trust-local-setup.md");
  const doc = readFileSync(docPath, "utf8");

  it("documents SEC-R3 local stack hardening section", () => {
    expect(doc).toContain("Local stack hardening (SEC-R3)");
    expect(doc).toContain("V4-4");
  });

  it("documents coordination bind address and TLS contrast", () => {
    expect(doc).toContain("127.0.0.1:8787");
    expect(doc).toContain("--ip 127.0.0.1");
    expect(doc).toContain("https://");
    expect(doc).toContain("wss://");
  });

  it("documents docker compose entry points for relay dev", () => {
    expect(doc).toContain("pnpm dev:relay:docker");
    expect(doc).toContain("pnpm dev:relay:gateway:docker");
    expect(doc).toContain("infra/docker-compose.nostr.yml");
    expect(doc).toContain("127.0.0.1:7000:8080");
  });

  it("documents relay in-container bind and pubkey whitelist hardening", () => {
    expect(doc).toContain('address = "0.0.0.0"');
    expect(doc).toContain("pubkey_whitelist");
  });

  it("verify:relay-v1.9.5 includes SEC-R3 doc contract test", () => {
    const pkg = readFileSync(path.join(repoRoot, "package.json"), "utf8");
    expect(pkg).toContain("verify:relay-v1.9.5");
    expect(pkg).toMatch(/private-trust-local-setup-sec-r3\.contract\.test\.ts/);
  });
});
