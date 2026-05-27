import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { cryptoService } from "../../crypto/crypto-service";
import { logAppEvent } from "@/app/shared/log-app-event";
import { toCommunityMembershipLedgerKey } from "./community-membership-ledger";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

// ---------------------------------------------------------------------------
// Community Leave Proof — Relay-evidence leave record
//
// When a user leaves a community, a self-encrypted "leave proof" event is
// published to the user's relay set as a replaceable Kind 30078 event.
// On restore, this event is fetched and used to filter out groups the user
// has explicitly left, even if the encrypted backup is stale and still
// contains the group in its createdGroups / ledger.
//
// This solves the fundamental dilemma of community sync: the backup may be
// stale (published before the leave), but the leave proof is published
// independently and survives across devices.
// ---------------------------------------------------------------------------

export const COMMUNITY_LEAVE_PROOF_EVENT_KIND = 30078;
export const COMMUNITY_LEAVE_PROOF_D_TAG = "obscur-community-leave-proofs";

export type CommunityLeaveProofEntry = Readonly<{
  groupId: string;
  relayUrl: string;
  leftAtUnixMs: number;
}>;

export type CommunityLeaveProofSnapshot = Readonly<{
  version: 1;
  entries: ReadonlyArray<CommunityLeaveProofEntry>;
  updatedAtUnixMs: number;
}>;

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const isValidEntry = (value: unknown): value is CommunityLeaveProofEntry => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.groupId === "string" &&
    typeof v.relayUrl === "string" &&
    typeof v.leftAtUnixMs === "number"
  );
};

export const parseLeaveProofSnapshot = (raw: unknown): CommunityLeaveProofSnapshot | null => {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (v.version !== 1) return null;
  if (!Array.isArray(v.entries)) return null;
  if (typeof v.updatedAtUnixMs !== "number") return null;
  const entries = v.entries.filter(isValidEntry);
  return {
    version: 1,
    entries,
    updatedAtUnixMs: v.updatedAtUnixMs,
  };
};

// ---------------------------------------------------------------------------
// Build leave proof key set (for filtering groups during restore)
// ---------------------------------------------------------------------------

export const buildLeaveProofKeySet = (
  entries: ReadonlyArray<CommunityLeaveProofEntry>,
): ReadonlySet<string> => {
  const keys = new Set<string>();
  for (const entry of entries) {
    const key = toCommunityMembershipLedgerKey({ groupId: entry.groupId, relayUrl: entry.relayUrl });
    if (key) keys.add(key);
  }
  return keys;
};

// ---------------------------------------------------------------------------
// Merge local + remote leave proofs (union, newest wins per group key)
// ---------------------------------------------------------------------------

export const mergeLeaveProofEntries = (
  local: ReadonlyArray<CommunityLeaveProofEntry>,
  remote: ReadonlyArray<CommunityLeaveProofEntry>,
): ReadonlyArray<CommunityLeaveProofEntry> => {
  const byKey = new Map<string, CommunityLeaveProofEntry>();
  const mergeEntry = (entry: CommunityLeaveProofEntry): void => {
    const key = toCommunityMembershipLedgerKey({ groupId: entry.groupId, relayUrl: entry.relayUrl });
    if (!key) return;
    const existing = byKey.get(key);
    if (!existing || entry.leftAtUnixMs > existing.leftAtUnixMs) {
      byKey.set(key, entry);
    }
  };
  for (const entry of local) mergeEntry(entry);
  for (const entry of remote) mergeEntry(entry);
  return Array.from(byKey.values());
};

// ---------------------------------------------------------------------------
// Add a leave entry (called when user leaves a community)
// ---------------------------------------------------------------------------

export const addLeaveProofEntry = (
  currentEntries: ReadonlyArray<CommunityLeaveProofEntry>,
  entry: Omit<CommunityLeaveProofEntry, "leftAtUnixMs"> & { leftAtUnixMs?: number },
): ReadonlyArray<CommunityLeaveProofEntry> => {
  const newEntry: CommunityLeaveProofEntry = {
    groupId: entry.groupId,
    relayUrl: entry.relayUrl,
    leftAtUnixMs: entry.leftAtUnixMs ?? Date.now(),
  };
  return mergeLeaveProofEntries(currentEntries, [newEntry]);
};

// ---------------------------------------------------------------------------
// Remove a leave entry (called when user re-joins a community)
// ---------------------------------------------------------------------------

export const removeLeaveProofEntry = (
  currentEntries: ReadonlyArray<CommunityLeaveProofEntry>,
  params: Readonly<{ groupId: string; relayUrl: string }>,
): ReadonlyArray<CommunityLeaveProofEntry> => {
  const targetKey = toCommunityMembershipLedgerKey(params);
  if (!targetKey) return currentEntries;
  return currentEntries.filter((entry) => {
    const key = toCommunityMembershipLedgerKey({ groupId: entry.groupId, relayUrl: entry.relayUrl });
    return key !== targetKey;
  });
};

// ---------------------------------------------------------------------------
// Build snapshot for publishing
// ---------------------------------------------------------------------------

export const buildLeaveProofSnapshot = (
  entries: ReadonlyArray<CommunityLeaveProofEntry>,
): CommunityLeaveProofSnapshot => ({
  version: 1,
  entries,
  updatedAtUnixMs: Date.now(),
});

// ---------------------------------------------------------------------------
// Encrypt / decrypt snapshot (self-to-self encrypted)
// ---------------------------------------------------------------------------

export const encryptLeaveProofSnapshot = async (
  snapshot: CommunityLeaveProofSnapshot,
  publicKeyHex: PublicKeyHex,
  privateKeyHex: PrivateKeyHex,
): Promise<string> => {
  const plaintext = JSON.stringify(snapshot);
  return cryptoService.encryptDM(plaintext, publicKeyHex, privateKeyHex);
};

export const decryptLeaveProofSnapshot = async (
  ciphertext: string,
  publicKeyHex: PublicKeyHex,
  privateKeyHex: PrivateKeyHex,
): Promise<CommunityLeaveProofSnapshot | null> => {
  try {
    const plaintext = await cryptoService.decryptDM(ciphertext, publicKeyHex, privateKeyHex);
    const parsed = JSON.parse(plaintext);
    return parseLeaveProofSnapshot(parsed);
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Build unsigned Nostr event for publishing
// ---------------------------------------------------------------------------

export const buildLeaveProofUnsignedEvent = (params: Readonly<{
  ciphertext: string;
  publicKeyHex: PublicKeyHex;
}>): {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey: string;
} => ({
  kind: COMMUNITY_LEAVE_PROOF_EVENT_KIND,
  created_at: Math.floor(Date.now() / 1000),
  tags: [["d", COMMUNITY_LEAVE_PROOF_D_TAG]],
  content: params.ciphertext,
  pubkey: params.publicKeyHex,
});

// ---------------------------------------------------------------------------
// Publish leave proof to relay
// ---------------------------------------------------------------------------

type RelayPoolLike = Readonly<{
  publishToUrls?: (urls: ReadonlyArray<string>, payload: string) => Promise<{ success: boolean; overallError?: string }>;
  publishToAll?: (payload: string) => Promise<{ success: boolean; overallError?: string }>;
}>;

export const publishLeaveProofToRelay = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  snapshot: CommunityLeaveProofSnapshot;
  pool: RelayPoolLike;
  scopedRelayUrls?: ReadonlyArray<string>;
}>): Promise<{ success: boolean; error?: string }> => {
  try {
    const ciphertext = await encryptLeaveProofSnapshot(
      params.snapshot,
      params.publicKeyHex,
      params.privateKeyHex,
    );
    const unsigned = buildLeaveProofUnsignedEvent({
      ciphertext,
      publicKeyHex: params.publicKeyHex,
    });
    const signedEvent = await cryptoService.signEvent(unsigned, params.privateKeyHex);
    const payload = JSON.stringify(["EVENT", signedEvent]);

    let result: { success: boolean; overallError?: string };
    if (params.scopedRelayUrls && params.scopedRelayUrls.length > 0 && typeof params.pool.publishToUrls === "function") {
      result = await params.pool.publishToUrls(params.scopedRelayUrls, payload);
    } else {
      // Proof is already persisted locally; skip global relay fanout when no writable scoped relay.
      return { success: true };
    }

    logAppEvent({
      name: "groups.leave_proof_published",
      level: result.success ? "info" : "warn",
      scope: { feature: "groups", action: "leave_proof" },
      context: {
        entryCount: params.snapshot.entries.length,
        success: result.success,
        error: result.overallError ?? null,
      },
    });

    return { success: result.success, error: result.overallError };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAppEvent({
      name: "groups.leave_proof_publish_error",
      level: "warn",
      scope: { feature: "groups", action: "leave_proof" },
      context: { error: message },
    });
    return { success: false, error: message };
  }
};

// ---------------------------------------------------------------------------
// Fetch leave proof from relay (used during restore)
// ---------------------------------------------------------------------------

type RelayPoolWithSubscribe = Readonly<{
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
}>;

export const fetchLeaveProofFromRelay = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  pool: RelayPoolWithSubscribe;
  timeoutMs?: number;
}>): Promise<CommunityLeaveProofSnapshot | null> => {
  const timeout = params.timeoutMs ?? 5000;

  return new Promise<CommunityLeaveProofSnapshot | null>((resolve) => {
    const subId = `leave-proof-${Math.random().toString(36).slice(2, 10)}`;
    let latestEvent: { content: string; created_at: number } | null = null;
    let settled = false;
    let timeoutId: number | null = null;

    const finish = async (): Promise<void> => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      cleanup();

      // Close subscription
      try {
        params.pool.sendToOpen(JSON.stringify(["CLOSE", subId]));
      } catch {
        // best-effort
      }

      if (!latestEvent) {
        resolve(null);
        return;
      }

      try {
        const snapshot = await decryptLeaveProofSnapshot(
          latestEvent.content,
          params.publicKeyHex,
          params.privateKeyHex,
        );
        logAppEvent({
          name: "groups.leave_proof_fetched",
          level: "info",
          scope: { feature: "groups", action: "leave_proof" },
          context: {
            entryCount: snapshot?.entries.length ?? 0,
            hasSnapshot: !!snapshot,
          },
        });
        resolve(snapshot);
      } catch {
        resolve(null);
      }
    };

    const cleanup = params.pool.subscribeToMessages(({ message }) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed[1] !== subId) return;

        if (parsed[0] === "EVENT") {
          const event = parsed[2] as { kind: number; pubkey: string; content: string; created_at: number; tags: string[][] };
          if (
            event.kind === COMMUNITY_LEAVE_PROOF_EVENT_KIND &&
            event.pubkey === params.publicKeyHex &&
            event.tags.some((tag) => tag[0] === "d" && tag[1] === COMMUNITY_LEAVE_PROOF_D_TAG)
          ) {
            if (!latestEvent || event.created_at > latestEvent.created_at) {
              latestEvent = { content: event.content, created_at: event.created_at };
            }
          }
        }

        if (parsed[0] === "EOSE") {
          void finish();
        }
      } catch {
        // ignore malformed
      }
    });

    params.pool.sendToOpen(JSON.stringify([
      "REQ",
      subId,
      {
        authors: [params.publicKeyHex],
        kinds: [COMMUNITY_LEAVE_PROOF_EVENT_KIND],
        "#d": [COMMUNITY_LEAVE_PROOF_D_TAG],
        limit: 1,
      },
    ]));

    timeoutId = window.setTimeout(() => {
      void finish();
    }, timeout) as unknown as number;
  });
};

// ---------------------------------------------------------------------------
// Local storage cache (so we don't lose leave proofs between sessions)
// ---------------------------------------------------------------------------

const LEAVE_PROOF_STORAGE_KEY_PREFIX = "obscur.community.leave_proofs.v1";

const toStorageKey = (publicKeyHex: string, profileId?: string): string =>
  getScopedStorageKey(
    `${LEAVE_PROOF_STORAGE_KEY_PREFIX}.${publicKeyHex}`,
    profileId ?? getResolvedProfileId(),
  );

export const loadLocalLeaveProofs = (
  publicKeyHex: string,
  profileId?: string,
): ReadonlyArray<CommunityLeaveProofEntry> => {
  try {
    const raw = window.localStorage.getItem(toStorageKey(publicKeyHex, profileId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const snapshot = parseLeaveProofSnapshot(parsed);
    return snapshot?.entries ?? [];
  } catch {
    return [];
  }
};

export const saveLocalLeaveProofs = (
  publicKeyHex: string,
  entries: ReadonlyArray<CommunityLeaveProofEntry>,
  profileId?: string,
): void => {
  try {
    const snapshot = buildLeaveProofSnapshot(entries);
    window.localStorage.setItem(toStorageKey(publicKeyHex, profileId), JSON.stringify(snapshot));
  } catch {
    // best-effort
  }
};

// ---------------------------------------------------------------------------
// High-level: record leave and publish
// ---------------------------------------------------------------------------

export const recordCommunityLeaveProof = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  groupId: string;
  relayUrl: string;
  pool: RelayPoolLike;
  scopedRelayUrls?: ReadonlyArray<string>;
  profileId?: string;
}>): Promise<{ success: boolean; error?: string }> => {
  const localEntries = loadLocalLeaveProofs(params.publicKeyHex, params.profileId);
  const updatedEntries = addLeaveProofEntry(localEntries, {
    groupId: params.groupId,
    relayUrl: params.relayUrl,
  });
  saveLocalLeaveProofs(params.publicKeyHex, updatedEntries, params.profileId);

  const snapshot = buildLeaveProofSnapshot(updatedEntries);
  return publishLeaveProofToRelay({
    publicKeyHex: params.publicKeyHex,
    privateKeyHex: params.privateKeyHex,
    snapshot,
    pool: params.pool,
    scopedRelayUrls: params.scopedRelayUrls,
  });
};

// ---------------------------------------------------------------------------
// High-level: remove leave proof on rejoin
// ---------------------------------------------------------------------------

export const removeCommunityLeaveProofOnRejoin = async (params: Readonly<{
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  groupId: string;
  relayUrl: string;
  pool: RelayPoolLike;
  scopedRelayUrls?: ReadonlyArray<string>;
  profileId?: string;
}>): Promise<void> => {
  const localEntries = loadLocalLeaveProofs(params.publicKeyHex, params.profileId);
  const updatedEntries = removeLeaveProofEntry(localEntries, {
    groupId: params.groupId,
    relayUrl: params.relayUrl,
  });
  saveLocalLeaveProofs(params.publicKeyHex, updatedEntries, params.profileId);

  // Publish updated snapshot (without the removed entry)
  const snapshot = buildLeaveProofSnapshot(updatedEntries);
  await publishLeaveProofToRelay({
    publicKeyHex: params.publicKeyHex,
    privateKeyHex: params.privateKeyHex,
    snapshot,
    pool: params.pool,
    scopedRelayUrls: params.scopedRelayUrls,
  });
};
