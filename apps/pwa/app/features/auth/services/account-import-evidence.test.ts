import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../utils/identity-profile-binding", () => ({
  findStoredIdentityBindingByPublicKey: vi.fn(),
}));

vi.mock("@/app/features/relays/utils/create-relay-websocket", () => ({
  createRelayWebSocket: vi.fn(),
}));

import { findStoredIdentityBindingByPublicKey } from "../utils/identity-profile-binding";
import { createRelayWebSocket } from "@/app/features/relays/utils/create-relay-websocket";
import { accountImportEvidenceInternals, resolveAccountImportEvidence } from "./account-import-evidence";
import { ACCOUNT_BACKUP_D_TAG, ACCOUNT_BACKUP_EVENT_KIND } from "@/app/features/account-sync/account-sync-contracts";

describe("account import evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts existing local binding without relay lookup", async () => {
    vi.mocked(findStoredIdentityBindingByPublicKey).mockResolvedValue({
      profileId: "pk-test",
      record: {
        encryptedPrivateKey: "cipher",
        publicKeyHex: "f".repeat(64),
      },
    });

    const result = await resolveAccountImportEvidence("f".repeat(64) as any);

    expect(result.localBinding).toBe(true);
    expect(result.relayUrlsChecked).toEqual([]);
    expect(createRelayWebSocket).not.toHaveBeenCalled();
  });

  it("detects relay profile evidence when no local binding exists", async () => {
    vi.mocked(findStoredIdentityBindingByPublicKey).mockResolvedValue(null);

    vi.mocked(createRelayWebSocket).mockImplementation(() => {
      let subId = "";
      const socket: Record<string, any> = {
        send: vi.fn((payload: string) => {
          subId = JSON.parse(payload)[1];
        }),
        close: vi.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };
      queueMicrotask(() => {
        socket.onopen?.();
        socket.onmessage?.({
          data: JSON.stringify(["EVENT", subId, {
            pubkey: "f".repeat(64),
            kind: 0,
            tags: [],
          }]),
        });
      });
      return socket as WebSocket;
    });

    const result = await accountImportEvidenceInternals.checkRelayForEvidence(
      "wss://relay.example",
      "f".repeat(64) as any
    );

    expect(result.profileSeen).toBe(true);
    expect(result.backupSeen).toBe(false);
  });

  it("detects relay backup evidence", async () => {
    vi.mocked(createRelayWebSocket).mockImplementation(() => {
      let subId = "";
      const socket: Record<string, any> = {
        send: vi.fn((payload: string) => {
          subId = JSON.parse(payload)[1];
        }),
        close: vi.fn(),
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null,
      };
      queueMicrotask(() => {
        socket.onopen?.();
        socket.onmessage?.({
          data: JSON.stringify(["EVENT", subId, {
            pubkey: "f".repeat(64),
            kind: ACCOUNT_BACKUP_EVENT_KIND,
            tags: [["d", ACCOUNT_BACKUP_D_TAG]],
          }]),
        });
      });
      return socket as WebSocket;
    });

    const result = await accountImportEvidenceInternals.checkRelayForEvidence(
      "wss://relay.example",
      "f".repeat(64) as any
    );

    expect(result.profileSeen).toBe(false);
    expect(result.backupSeen).toBe(true);
  });
});
