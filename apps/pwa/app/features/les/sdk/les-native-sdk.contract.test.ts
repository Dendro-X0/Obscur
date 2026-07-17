/**
 * L1 contract — LES SDK is thin; functional owner is Rust.
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "../..");

describe("LES radical rewrite contracts", () => {
  it("places functional LES core in libobscur Rust", () => {
    const intake = readFileSync(
      path.join(repoRoot, "packages/libobscur/src/les/intake.rs"),
      "utf8",
    );
    expect(intake).toContain("pub fn commit_object");
    expect(intake).toContain("pub fn delete_object");
    expect(intake).toContain("write_encrypted_file");
    expect(intake).toContain("catalog row missing");
  });

  it("exposes Tauri LES commands without TS persistence", () => {
    const commands = readFileSync(
      path.join(repoRoot, "apps/desktop/src-tauri/src/commands/les.rs"),
      "utf8",
    );
    expect(commands).toContain("desktop_les_commit");
    expect(commands).toContain("desktop_les_list");
    expect(commands).toContain("desktop_les_delete");
    expect(commands).toContain("libobscur::les::commit_object");
    expect(commands).toContain("libobscur::les::delete_object");
  });

  it("keeps the TypeScript layer as an invoke SDK only", () => {
    const sdk = readFileSync(
      path.join(process.cwd(), "app/features/les/sdk/les-native-sdk.ts"),
      "utf8",
    );
    expect(sdk).toContain("desktop_les_commit");
    expect(sdk).toContain("desktop_les_delete");
    expect(sdk).toContain("commitLesObjectWithProof");
    expect(sdk).toContain("deleteLesObject");
    expect(sdk).not.toMatch(/localStorage|IndexedDB|cacheAttachmentLocally/);
  });

  it("does not implement LES by editing the cursed vault store", () => {
    const charter = readFileSync(
      path.join(repoRoot, "specs/backend/vault-les-radical-redesign-2026-07.md"),
      "utf8",
    );
    expect(charter).toContain("Functional rewrite → **Rust**");
    expect(charter).toContain("do **not** evolve `features/vault/**`");
  });
});
