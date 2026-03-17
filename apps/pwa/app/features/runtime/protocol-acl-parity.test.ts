import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(process.cwd(), "..", "..");
const aclPath = resolve(repoRoot, "apps/desktop/src-tauri/permissions/app.toml");
const protocolAdapterPath = resolve(repoRoot, "apps/pwa/app/features/runtime/protocol-core-adapter.ts");
const powServicePath = resolve(repoRoot, "apps/pwa/app/features/crypto/pow-service.ts");

describe("protocol command ACL parity", () => {
  it("ensures every invoked protocol command and mine_pow is permitted in app ACL", () => {
    const aclSource = readFileSync(aclPath, "utf8");
    const adapterSource = readFileSync(protocolAdapterPath, "utf8");
    const powSource = readFileSync(powServicePath, "utf8");

    const invokedProtocolCommands = [
      ...adapterSource.matchAll(/"(protocol_[a-z0-9_]+)"/g),
      ...powSource.matchAll(/"(mine_pow)"/g),
    ].map((m) => m[1]);
    const aclCommands = new Set((aclSource.match(/"([a-z0-9_]+)"/g) ?? []).map((v) => v.slice(1, -1)));

    for (const command of new Set(invokedProtocolCommands)) {
      expect(aclCommands.has(command), `Missing ACL permission for command ${command}`).toBe(true);
    }
  });
});

