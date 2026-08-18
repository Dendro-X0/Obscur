import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("auth surface conflict surfacing (Containment C)", () => {
  it("uses unified auth surface conflict resolver on AuthScreen", () => {
    const source = read("app/features/auth/components/auth-screen.tsx");
    expect(source).toMatch(/resolveAuthSurfaceConflicts/);
    expect(source).toMatch(/AuthSurfaceConflictBanner/);
    expect(source).toMatch(/isAuthKernelManualLockActive/);
  });

  it("maps manual lock and mismatch kinds in resolver", () => {
    const source = read("app/features/auth/services/resolve-auth-surface-conflict.ts");
    expect(source).toMatch(/manual_lock/);
    expect(source).toMatch(/active_session_lease/);
    expect(source).toMatch(/profile_slot_conflict/);
    expect(source).toMatch(/native_mismatch/);
  });
});
