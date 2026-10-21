import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("connection-store behavior deprivilege (Containment B)", () => {
  it("does not hydrate conversations from global connectionStore", () => {
    const source = read("app/features/messaging/hooks/use-conversations.ts");
    expect(source).not.toMatch(/from.*connection-store/);
    expect(source).not.toMatch(/connectionStore\./);
    expect(source).toContain("Do not hydrate from global `connectionStore`");
  });

  it("fail-closes legacy canMessageConnection gating", () => {
    const source = read("app/features/invites/utils/messaging-integration.ts");
    expect(source).toMatch(/canMessageConnection[\s\S]*=>\s*false/);
    expect(source).not.toMatch(/getConnectionByPublicKeyCompat/);
  });

  it("does not merge address-book rows into requests inbox", () => {
    const source = read("app/features/messaging/services/contact-request-legacy-orphan.ts");
    expect(source).not.toMatch(/params\.createdConnections\.forEach/);
  });

  it("does not load profile metadata from connectionStore", () => {
    const source = read("app/features/profile/hooks/use-profile-metadata.ts");
    expect(source).not.toMatch(/connectionStore/);
  });
});
