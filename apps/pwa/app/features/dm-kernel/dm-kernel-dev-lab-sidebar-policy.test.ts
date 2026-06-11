import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  DM_KERNEL_WRITE_PROBE_CONVERSATION_ID,
  filterDevLabSyntheticSidebarRows,
  isDevLabSyntheticSidebarRow,
} from "./dm-kernel-dev-lab-sidebar-policy";
import type { DmConversation } from "@/app/features/messaging/types";

const tester1Pubkey = "c09832d637eb265d90b29c12eb8dfcfffe165b8fb34094af75236d5be4d97884" as PublicKeyHex;

const row = (overrides: Partial<DmConversation> & Pick<DmConversation, "id" | "lastMessage">): DmConversation => ({
  kind: "dm",
  pubkey: tester1Pubkey,
  displayName: tester1Pubkey,
  unreadCount: 0,
  lastMessageTime: new Date(0),
  ...overrides,
});

describe("dm-kernel dev-lab sidebar policy", () => {
  it("flags relay backfill probe threads by preview text", () => {
    expect(isDevLabSyntheticSidebarRow(row({
      id: "dm:thread:abc",
      lastMessage: "dev-lab-relay-backfill-in-1780982585864",
    }))).toBe(true);
  });

  it("flags dm-kernel write probe conversation id", () => {
    expect(isDevLabSyntheticSidebarRow(row({
      id: DM_KERNEL_WRITE_PROBE_CONVERSATION_ID,
      lastMessage: "",
    }))).toBe(true);
  });

  it("keeps real Tester1↔Tester2 threads", () => {
    expect(isDevLabSyntheticSidebarRow(row({
      id: "dm:thread:real",
      lastMessage: "test",
    }))).toBe(false);
  });

  it("filters synthetic rows from sidebar list", () => {
    const filtered = filterDevLabSyntheticSidebarRows([
      row({ id: "dm:ghost", lastMessage: "dev-lab-relay-backfill-out-1" }),
      row({ id: "dm:real", lastMessage: "hello" }),
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.lastMessage).toBe("hello");
  });
});
