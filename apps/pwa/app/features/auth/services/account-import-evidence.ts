"use client";

import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { ACCOUNT_BACKUP_D_TAG, ACCOUNT_BACKUP_EVENT_KIND } from "@/app/features/account-sync/account-sync-contracts";
import { relayListInternals } from "@/app/features/relays/hooks/use-relay-list";
import { createRelayWebSocket } from "@/app/features/relays/utils/create-relay-websocket";
import { findStoredIdentityBindingByPublicKey } from "../utils/identity-profile-binding";

export type AccountImportEvidence = Readonly<{
  publicKeyHex: PublicKeyHex;
  localBinding: boolean;
  relayProfileEventSeen: boolean;
  relayBackupEventSeen: boolean;
  relayUrlsChecked: ReadonlyArray<string>;
}>;

const IMPORT_EVIDENCE_TIMEOUT_MS = 4_500;
const MAX_RELAY_CHECKS = 3;

const getRelayUrlsForImportCheck = (): ReadonlyArray<string> => {
  return relayListInternals.DEFAULT_RELAYS
    .filter((relay) => relay.enabled)
    .map((relay) => relay.url)
    .filter((url) => url.startsWith("ws://") || url.startsWith("wss://"))
    .slice(0, MAX_RELAY_CHECKS);
};

const checkRelayForEvidence = async (
  relayUrl: string,
  publicKeyHex: PublicKeyHex
): Promise<Readonly<{ profileSeen: boolean; backupSeen: boolean }>> => {
  return new Promise((resolve) => {
    let settled = false;
    let profileSeen = false;
    let backupSeen = false;
    const subId = `auth-import-${Math.random().toString(36).slice(2, 10)}`;
    const socket = createRelayWebSocket(relayUrl);

    const finish = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        socket.close();
      } catch {
        // Ignore socket close errors during auth preflight.
      }
      resolve({ profileSeen, backupSeen });
    };

    const timeoutId = setTimeout(finish, IMPORT_EVIDENCE_TIMEOUT_MS);

    socket.onopen = () => {
      try {
        socket.send(JSON.stringify([
          "REQ",
          subId,
          { kinds: [0], authors: [publicKeyHex], limit: 1 },
          { kinds: [ACCOUNT_BACKUP_EVENT_KIND], authors: [publicKeyHex], "#d": [ACCOUNT_BACKUP_D_TAG], limit: 1 },
        ]));
      } catch {
        clearTimeout(timeoutId);
        finish();
      }
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data);
        if (!Array.isArray(parsed) || parsed[1] !== subId) {
          return;
        }
        if (parsed[0] === "EVENT") {
          const nostrEvent = parsed[2] as Record<string, unknown>;
          if (nostrEvent.pubkey !== publicKeyHex) {
            return;
          }
          if (nostrEvent.kind === 0) {
            profileSeen = true;
          }
          if (
            nostrEvent.kind === ACCOUNT_BACKUP_EVENT_KIND
            && Array.isArray(nostrEvent.tags)
            && (nostrEvent.tags as ReadonlyArray<ReadonlyArray<string>>).some((tag) => tag[0] === "d" && tag[1] === ACCOUNT_BACKUP_D_TAG)
          ) {
            backupSeen = true;
          }
          if (profileSeen || backupSeen) {
            clearTimeout(timeoutId);
            finish();
          }
        }
        if (parsed[0] === "EOSE") {
          clearTimeout(timeoutId);
          finish();
        }
      } catch {
        // Ignore malformed relay frames during import preflight.
      }
    };

    socket.onerror = () => {
      clearTimeout(timeoutId);
      finish();
    };
    socket.onclose = () => {
      clearTimeout(timeoutId);
      finish();
    };
  });
};

export const resolveAccountImportEvidence = async (
  publicKeyHex: PublicKeyHex
): Promise<AccountImportEvidence> => {
  const localBinding = (await findStoredIdentityBindingByPublicKey(publicKeyHex)) !== null;
  if (localBinding || typeof window === "undefined") {
    return {
      publicKeyHex,
      localBinding,
      relayProfileEventSeen: false,
      relayBackupEventSeen: false,
      relayUrlsChecked: [],
    };
  }

  const relayUrlsChecked = getRelayUrlsForImportCheck();
  let relayProfileEventSeen = false;
  let relayBackupEventSeen = false;

  for (const relayUrl of relayUrlsChecked) {
    const result = await checkRelayForEvidence(relayUrl, publicKeyHex);
    relayProfileEventSeen = relayProfileEventSeen || result.profileSeen;
    relayBackupEventSeen = relayBackupEventSeen || result.backupSeen;
    if (relayProfileEventSeen || relayBackupEventSeen) {
      break;
    }
  }

  return {
    publicKeyHex,
    localBinding,
    relayProfileEventSeen,
    relayBackupEventSeen,
    relayUrlsChecked,
  };
};

export const accountImportEvidenceInternals = {
  checkRelayForEvidence,
  getRelayUrlsForImportCheck,
};
