import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PWA_ROOT = join(__dirname, "../../../../");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

const LEGACY_IMPORT = /chat-state-store-legacy/;

/** w21 — feature owners route through concern ports; legacy import stays in ports + legacy/ only. */
const W21_ROUTED_PRODUCTION_PATHS = [
  "app/features/account-sync/services/restore-materialization.ts",
  "app/features/account-sync/services/encrypted-account-backup-service.ts",
  "app/features/account-sync/services/account-event-bootstrap-service.ts",
  "app/features/account-sync/services/account-sync-drift-detector.ts",
  "app/features/messaging/services/message-persistence-service.ts",
  "app/features/messaging/hooks/use-requests-inbox.ts",
  "app/features/messaging/services/gather-dm-thread-messages-for-delete.ts",
  "app/features/messaging/services/dm-thread-sync-seed-loader.ts",
  "app/features/messaging/local-dm-visibility/local-dm-visibility-owner.ts",
  "app/features/messaging/components/chat-state-durability-owner.tsx",
  "app/features/groups/components/sealed-group-message-durability-owner.tsx",
  "app/features/groups/services/community-dm-invite-pipeline.ts",
  "app/features/groups/services/group-client-operations.ts",
  "app/features/runtime/components/account-scope-boundary-owner.tsx",
  "app/features/runtime/services/account-session-hard-reset.ts",
  "app/features/profiles/services/data-root-group-metadata-repair.ts",
  "app/features/profiles/services/obscur-data-root-service.ts",
  "app/features/workspace-kernel/workspace-kernel-group-metadata-store.ts",
  "app/features/groups/hooks/use-community-participant-roster-read-model.ts",
  "app/features/vault/services/cas-media-recovery.ts",
  "app/features/network/hooks/use-peer-trust.ts",
  "app/features/network/services/identity-integrity-migration.ts",
  "app/groups/[...id]/group-home-page-client.tsx",
] as const;

describe("messaging chat-state ports w21 contract", () => {
  it("w21 production paths do not import chat-state-store-legacy directly", () => {
    for (const relativePath of W21_ROUTED_PRODUCTION_PATHS) {
      expect(read(relativePath), relativePath).not.toMatch(LEGACY_IMPORT);
    }
  });

  it("account-sync band uses account-sync-chat-state-port", () => {
    const restore = read("app/features/account-sync/services/restore-materialization.ts");
    expect(restore).toContain("accountSyncChatStatePort");
    expect(restore).not.toMatch(LEGACY_IMPORT);
  });

  it("message persistence uses messaging-chat-state-message-port", () => {
    const persistence = read("app/features/messaging/services/message-persistence-service.ts");
    expect(persistence).toContain("messagingChatStateMessagePort");
    expect(persistence).not.toMatch(LEGACY_IMPORT);
  });

  it("durability owners use messaging-chat-state-durability-port", () => {
    const chatDurability = read("app/features/messaging/components/chat-state-durability-owner.tsx");
    const groupDurability = read("app/features/groups/components/sealed-group-message-durability-owner.tsx");
    expect(chatDurability).toContain("messagingChatStateDurabilityPort");
    expect(groupDurability).toContain("messagingChatStateDurabilityPort");
    expect(chatDurability).not.toMatch(LEGACY_IMPORT);
    expect(groupDurability).not.toMatch(LEGACY_IMPORT);
  });

  it("read evidence paths use messaging-chat-state-read-port", () => {
    const workspace = read("app/features/workspace-kernel/workspace-kernel-group-metadata-store.ts");
    const peerTrust = read("app/features/network/hooks/use-peer-trust.ts");
    expect(workspace).toContain("messagingChatStateReadPort");
    expect(peerTrust).toContain("messagingChatStateReadPort");
    expect(workspace).not.toMatch(LEGACY_IMPORT);
    expect(peerTrust).not.toMatch(LEGACY_IMPORT);
  });
});
