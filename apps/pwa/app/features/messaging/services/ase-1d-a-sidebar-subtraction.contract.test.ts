import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("ASE-1d-a contact-request sidebar subtraction", () => {
  it("does not create a Chats row after sendConnectionRequest in new-chat-dialog", () => {
    const source = read("app/features/messaging/components/new-chat-dialog.tsx");
    expect(source).not.toMatch(/handleSendRequest[\s\S]*onCreate\(resolvedPubkeyHex\)/);
  });

  it("blocks handleCreateChat from materializing strangers in global-dialog-manager", () => {
    const source = read("app/features/messaging/components/global-dialog-manager.tsx");
    expect(source).toContain("ASE-1d-a");
    expect(source).toMatch(/!peerTrust\.isAccepted\(\{ publicKeyHex: targetPublicKeyHex \}\)/);
  });

  it("marks outgoing pending in request-transport sendRequest", () => {
    const source = read("app/features/messaging/services/request-transport-service.ts");
    expect(source).toMatch(/sendRequest[\s\S]*setStatus[\s\S]*pending[\s\S]*isOutgoing:\s*true/);
  });

  it("hides pending handshakes from Chats established resolver", () => {
    const source = read("app/features/messaging/services/dm-peer-established-ui.ts");
    expect(source).toContain("isPendingContactHandshake");
    expect(source).not.toContain("establishedDmPeerPubkeys");
    expect(source).toMatch(/resolveDmPeerEstablishedForUi[\s\S]*status === "accepted"/);
  });

  it("routes legacy orphan DM threads through requests inbox merge", () => {
    const source = read("app/features/messaging/services/request-inbox-canonical-filter.ts");
    expect(source).toContain("isCanonicalContactRequestInboxItem");
  });
});
