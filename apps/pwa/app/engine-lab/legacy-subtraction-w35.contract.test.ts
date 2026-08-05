import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

describe("legacy subtraction w35 — native conversation hydrate owner deleted", () => {
  it("native hydrate owner legacy file is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/native-dm-conversation-hydrate-owner-legacy.ts",
    );
  });

  it("native hydrate owner legacy file stays deleted", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/native-dm-conversation-hydrate-owner-legacy.ts"))).toBe(false);
  });

  it("canonical native hydrate refuse owner deleted (Wave 4)", () => {
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/native-dm-conversation-hydrate-owner.ts"))).toBe(false);
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/services/native-dm-conversation-hydrate-port.ts"))).toBe(false);
  });

  it("thick use-conversation-messages-legacy hook is deleted", () => {
    expect(existsSync(join(PWA_ROOT, "app/features/messaging/hooks/use-conversation-messages-legacy.ts"))).toBe(false);
  });
});
