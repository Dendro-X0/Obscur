/**
 * B10 — remaining SubtleCrypto inventory contract.
 * @see specs/backend/crypto-subtlecrypto-inventory-b10-investigation-2026-10.md
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Production (non-test) allowlist — keep in sync with B10 investigation inventory. */
const ALLOWED_SUBTLE_SITES = [
  "features/crypto/crypto-service-impl.ts",
  "features/messaging/lib/message-queue.ts",
  "features/messaging/lib/nip96-upload-service.ts",
  "features/messaging/controllers/dm-event-builder.ts",
  "features/messaging/controllers/v2/dm-send-pipeline.ts",
  "features/messaging/services/dm-delete-target-derivation.ts",
  "features/storage/services/storage-envelope-v1.ts",
  "features/storage/services/profile-data-key.ts",
  "features/auth/services/pin-lock-service.ts",
  "features/auth/services/pow-key-generator.ts",
  "features/security/services/security-audit-log.ts",
  "features/security/services/identicon-service.ts",
  "features/vault/services/local-media-store.ts",
] as const;

const isProductionSource = (relativePath: string): boolean => {
  if (!/\.(ts|tsx)$/.test(relativePath)) return false;
  if (/\.test\.(ts|tsx)$/.test(relativePath)) return false;
  if (/\.contract\.test\.(ts|tsx)$/.test(relativePath)) return false;
  if (relativePath.includes("__tests__/")) return false;
  return true;
};

const walkTsFiles = (dir: string, base: string, out: string[]): void => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const rel = path.relative(base, full).split(path.sep).join("/");
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
      walkTsFiles(full, base, out);
      continue;
    }
    if (isProductionSource(rel)) out.push(rel);
  }
};

describe("B10 SubtleCrypto inventory", () => {
  const cryptoDir = __dirname;
  const appRoot = path.resolve(cryptoDir, "../..");
  const repoRoot = path.resolve(appRoot, "../../..");
  const readRepo = (relativePath: string) =>
    readFileSync(path.join(repoRoot, relativePath), "utf8");
  const readApp = (relativePath: string) =>
    readFileSync(path.join(appRoot, relativePath), "utf8");

  it("pins investigation inventory with classifications and next mutate", () => {
    const inv = readRepo(
      "specs/backend/crypto-subtlecrypto-inventory-b10-investigation-2026-10.md",
    );
    expect(inv).toContain("HANDOFF ATOMIC STEP: B10");
    expect(inv).toContain("deriveRumorEventId");
    expect(inv).toContain("Preferred:");
    expect(inv).toContain("Do not");
    expect(inv).toMatch(/Class \| Meaning/);
  });

  it("production crypto.subtle sites stay on B10 allowlist", () => {
    const files: string[] = [];
    walkTsFiles(appRoot, appRoot, files);
    const hits = files
      .filter((rel) => readApp(rel).includes("crypto.subtle"))
      .sort();
    expect(hits).toEqual([...ALLOWED_SUBTLE_SITES].sort());
  });

  it("NativeCryptoService keeps fail-closed group/invite AES (no super fallback)", () => {
    const native = readFileSync(path.join(cryptoDir, "native-crypto-service.ts"), "utf8");
    expect(native).toContain("encrypt_group_message");
    expect(native).toContain("decrypt_group_message");
    expect(native).toContain("encrypt_invite_data");
    expect(native).toContain("decrypt_invite_data");
    expect(native).not.toMatch(/super\.encryptGroupMessage/);
    expect(native).not.toMatch(/super\.decryptGroupMessage/);
    expect(native).not.toMatch(/super\.encryptInviteData/);
    expect(native).not.toMatch(/super\.decryptInviteData/);
    expect(native).toContain("derive_rumor_event_id");
    expect(native).toContain("sign_invite_data");
    expect(native).toContain("verify_invite_signature");
    expect(native).toContain("derive_shared_secret");
    expect(native).toContain("generate_secure_random");
    expect(native).toContain("verify_nostr_event");
    expect(native).not.toContain("crypto.subtle");
  });

  it("CryptoServiceImpl remains browser owner for inherited SubtleCrypto methods", () => {
    const impl = readFileSync(path.join(cryptoDir, "crypto-service-impl.ts"), "utf8");
    expect(impl).toContain("deriveSharedSecret");
    expect(impl).toContain("signInviteData");
    expect(impl).toContain("verifyInviteSignature");
    expect(impl).toContain("crypto.subtle.digest");
    expect(impl).toContain("crypto.subtle.encrypt");
  });
});
