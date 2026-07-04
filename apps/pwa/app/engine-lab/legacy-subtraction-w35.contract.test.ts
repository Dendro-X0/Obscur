import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENGINE_LAB_SUBTRACTED_FILES } from "./legacy-subtraction-manifest";

const REPO_ROOT = join(__dirname, "../../../../");
const PWA_ROOT = join(REPO_ROOT, "apps/pwa");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("legacy subtraction w35 — native conversation hydrate owner deleted from legacy", () => {
  it("native hydrate owner legacy file is tombstoned in manifest", () => {
    expect(ENGINE_LAB_SUBTRACTED_FILES).toContain(
      "app/legacy/native-dm-conversation-hydrate-owner-legacy.ts",
    );
  });

  it("native hydrate owner legacy file stays deleted", () => {
    expect(existsSync(join(PWA_ROOT, "app/legacy/native-dm-conversation-hydrate-owner-legacy.ts"))).toBe(false);
  });

  it("canonical native hydrate owner lives in features without legacy imports", () => {
    const source = read("app/features/messaging/services/native-dm-conversation-hydrate-owner.ts");
    expect(source).toContain("runLegacyNativeDmConversationHistoryHydrate");
    expect(source).toContain("messagingClientOperations.hydrateDmThreadReadModel");
    expect(source).not.toMatch(/@\/app\/legacy\//);
  });

  it("native-dm-conversation-hydrate-port re-exports owner from features only", () => {
    const port = read("app/features/messaging/services/native-dm-conversation-hydrate-port.ts");
    expect(port).toContain("./native-dm-conversation-hydrate-owner");
    expect(port).not.toMatch(/@\/app\/legacy\//);
    expect(port).not.toContain("native-dm-conversation-hydrate-owner-legacy");
  });

  it("use-conversation-messages legacy routes native hydrate through hydrate port", () => {
    const hook = read("app/features/messaging/hooks/use-conversation-messages-legacy.ts");
    expect(hook).toContain("native-dm-conversation-hydrate-port");
    expect(hook).not.toContain("native-dm-conversation-hydrate-owner-legacy");
  });
});
