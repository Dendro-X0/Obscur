"use client";

import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { PROFILE_CHANGED_EVENT } from "@/app/features/profiles/services/profile-registry-service";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { seedProfileMetadataCache } from "@/app/features/profile/hooks/use-profile-metadata";
import { useProfileInternals, type UserProfile } from "@/app/features/profile/hooks/use-profile";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";
import { relayListInternals } from "@/app/features/relays/hooks/use-relay-list";
import type { RelayPoolLike } from "@/app/features/relays/lib/nostr-core-relay";
import { accountSyncStatusStore } from "./account-sync-status-store";
import { accountProjectionRuntime } from "./account-projection-runtime";
import { encryptedAccountBackupService } from "./encrypted-account-backup-service";
import { fetchLatestEventFromRelayUrls } from "./direct-relay-query";
import type {
  AccountRehydrateReport,
  AccountRestoreStatus,
  EncryptedAccountBackupPayload,
  RelayListSnapshot,
  RelayRehydrateProfile,
} from "../account-sync-contracts";

type RelayPoolForRehydrate = RelayPoolLike & Readonly<{
  sendToOpen: (payload: string) => void;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
}>;

const PROFILE_FETCH_TIMEOUT_MS = 4_000;

const getCandidateRelayUrls = (pool: RelayPoolForRehydrate): ReadonlyArray<string> => {
  return Array.from(new Set([
    ...pool.connections.map((connection) => connection.url),
    ...relayListInternals.DEFAULT_RELAYS.filter((relay) => relay.enabled).map((relay) => relay.url),
  ]));
};

const parseInviteCode = (event: NostrEvent): string => {
  for (const tag of event.tags) {
    if ((tag[0] === "code" || tag[0] === "i") && typeof tag[1] === "string" && tag[1].trim().length > 0) {
      return tag[1].trim().toUpperCase();
    }
  }
  return "";
};

const parseProfileEvent = (event: NostrEvent): RelayRehydrateProfile | null => {
  try {
    const content = JSON.parse(event.content) as Record<string, unknown>;
    return {
      publicKeyHex: event.pubkey as PublicKeyHex,
      username: typeof content.display_name === "string"
        ? content.display_name
        : (typeof content.name === "string" ? content.name : ""),
      about: typeof content.about === "string" ? content.about : "",
      avatarUrl: typeof content.picture === "string" ? content.picture : "",
      nip05: typeof content.nip05 === "string" ? content.nip05 : "",
      inviteCode: parseInviteCode(event),
      sourceEventId: event.id,
      updatedAtUnixMs: event.created_at * 1000,
    };
  } catch {
    return null;
  }
};

const parseRelayListFromEvent = (event: NostrEvent): RelayListSnapshot => {
  if (event.kind === 10002) {
    const relays = new Map<string, boolean>();
    for (const tag of event.tags) {
      if (tag[0] !== "r" || typeof tag[1] !== "string") {
        continue;
      }
      const marker = tag[2];
      relays.set(tag[1].trim(), marker !== "read");
    }
    return Array.from(relays.entries())
      .filter(([url]) => url.length > 0)
      .map(([url, enabled]) => ({ url, enabled }));
  }

  if (event.kind === 3) {
    try {
      const parsed = JSON.parse(event.content) as Record<string, { read?: boolean; write?: boolean }>;
      return Object.entries(parsed)
        .filter(([url]) => url.trim().length > 0)
        .map(([url, permissions]) => ({
          url: url.trim(),
          enabled: permissions?.write !== false,
        }));
    } catch {
      return [];
    }
  }

  return [];
};

const fetchLatestOwnEvent = async (
  pool: RelayPoolForRehydrate,
  publicKeyHex: PublicKeyHex,
  filters: ReadonlyArray<Record<string, unknown>>,
  matcher: (event: NostrEvent) => boolean
): Promise<NostrEvent | null> => {
  await pool.waitForConnection(2_500);
  const poolEvent = await new Promise<NostrEvent | null>((resolve) => {
    const subId = `account-rehydrate-${Math.random().toString(36).slice(2, 10)}`;
    let latestEvent: NostrEvent | null = null;
    let settled = false;
    const finish = (value: NostrEvent | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };
    const cleanup = pool.subscribeToMessages(({ message }) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed[1] !== subId) {
          return;
        }
        if (parsed[0] === "EVENT") {
          const event = parsed[2] as NostrEvent;
          if (event.pubkey === publicKeyHex && matcher(event) && (!latestEvent || event.created_at >= latestEvent.created_at)) {
            latestEvent = event;
          }
        }
        if (parsed[0] === "EOSE") {
          finish(latestEvent);
        }
      } catch {
        // Ignore malformed relay frames.
      }
    });
    pool.sendToOpen(JSON.stringify(["REQ", subId, ...filters]));
    window.setTimeout(() => finish(latestEvent), PROFILE_FETCH_TIMEOUT_MS);
  });
  if (poolEvent) {
    return poolEvent;
  }
  return fetchLatestEventFromRelayUrls({
    relayUrls: getCandidateRelayUrls(pool),
    filters,
    matcher,
    timeoutMs: PROFILE_FETCH_TIMEOUT_MS,
  });
};

const applyRelayProfile = (profile: RelayRehydrateProfile): void => {
  const current = useProfileInternals.loadFromStorage().profile;
  const nextProfile: UserProfile = {
    username: profile.username || current.username,
    about: profile.about || "",
    avatarUrl: profile.avatarUrl || "",
    nip05: profile.nip05 || "",
    inviteCode: profile.inviteCode || current.inviteCode,
  };
  useProfileInternals.saveToStorage({ profile: nextProfile });
  useProfileInternals.setState({ profile: nextProfile });
  useProfileInternals.notify();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT));
  }
  discoveryCache.upsertProfile({
    pubkey: profile.publicKeyHex,
    name: profile.username || undefined,
    displayName: profile.username || undefined,
    about: profile.about || undefined,
    picture: profile.avatarUrl || undefined,
    nip05: profile.nip05 || undefined,
    inviteCode: profile.inviteCode || undefined,
  });
  seedProfileMetadataCache({
    pubkey: profile.publicKeyHex,
    displayName: profile.username || undefined,
    avatarUrl: profile.avatarUrl || undefined,
    about: profile.about || undefined,
    nip05: profile.nip05 || undefined,
  });
};

const hasMeaningfulProfile = (profile: EncryptedAccountBackupPayload["profile"]): boolean => {
  return profile.username.trim().length > 0
    || (profile.about ?? "").trim().length > 0
    || profile.avatarUrl.trim().length > 0
    || profile.nip05.trim().length > 0;
};

const applyBackupProfile = (profile: EncryptedAccountBackupPayload["profile"]): void => {
  useProfileInternals.saveToStorage({ profile });
  useProfileInternals.setState({ profile });
  useProfileInternals.notify();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT));
  }
};

export const accountRehydrateService = {
  async rehydrateAccount(params: Readonly<{
    publicKeyHex: PublicKeyHex;
    privateKeyHex: PrivateKeyHex;
    pool: RelayPoolForRehydrate;
    cacheOnlyEncryptedBackup?: boolean;
  }>): Promise<AccountRehydrateReport> {
    accountSyncStatusStore.updateSnapshot({
      publicKeyHex: params.publicKeyHex,
      phase: "found_account",
      status: "identity_only",
      message: "Found your account",
    });

    accountSyncStatusStore.updateSnapshot({
      phase: "restoring_profile",
      message: "Restoring profile",
    });

    const [profileEvent, relayListEvent] = await Promise.all([
      fetchLatestOwnEvent(
        params.pool,
        params.publicKeyHex,
        [{ kinds: [0], authors: [params.publicKeyHex], limit: 1 }],
        (event) => event.kind === 0
      ),
      fetchLatestOwnEvent(
        params.pool,
        params.publicKeyHex,
        [
          { kinds: [10002], authors: [params.publicKeyHex], limit: 1 },
          { kinds: [3], authors: [params.publicKeyHex], limit: 1 },
        ],
        (event) => event.kind === 10002 || event.kind === 3
      ),
    ]);

    const relayProfile = profileEvent ? parseProfileEvent(profileEvent) : null;
    if (relayProfile) {
      applyRelayProfile(relayProfile);
    }

    const relayList = relayListEvent ? parseRelayListFromEvent(relayListEvent) : relayListInternals.loadRelayListFromStorage(params.publicKeyHex);
    if (relayList.length > 0) {
      relayListInternals.saveRelayListToStorage(params.publicKeyHex, relayList);
    }

    accountSyncStatusStore.updateSnapshot({
      phase: "restoring_account_data",
      status: relayProfile ? "public_restored" : "identity_only",
      message: "Restoring account data",
      lastPublicProfileFetchAtUnixMs: relayProfile?.updatedAtUnixMs,
      latestProfileEventId: relayProfile?.sourceEventId,
      lastRestoreSource: relayProfile ? "relay_profile" : "local_draft_only",
    });

    let restoreStatus: AccountRestoreStatus = relayProfile ? "public_restored" : "identity_only";
    let restoredBackupAtUnixMs: number | undefined;
    let latestBackupEventId: string | undefined;
    let degradedReason: string | undefined;
    const profileId = getActiveProfileIdSafe();

    try {
      const restoreResult = params.cacheOnlyEncryptedBackup
        ? await encryptedAccountBackupService.fetchLatestEncryptedAccountBackupPayload({
          publicKeyHex: params.publicKeyHex,
          privateKeyHex: params.privateKeyHex,
          pool: params.pool,
        })
        : await encryptedAccountBackupService.restoreEncryptedAccountBackup({
          publicKeyHex: params.publicKeyHex,
          privateKeyHex: params.privateKeyHex,
          pool: params.pool,
          profileId,
          appendCanonicalEvents: accountProjectionRuntime.appendCanonicalEvents.bind(accountProjectionRuntime),
        });
      if (params.cacheOnlyEncryptedBackup) {
        accountSyncStatusStore.updateSnapshot({
          lastRestoreSource: restoreResult.hasBackup ? "encrypted_backup" : "local_draft_only",
        });
      }
      if (restoreResult.degradedReason) {
        degradedReason = restoreResult.degradedReason;
        restoreStatus = relayProfile ? "degraded" : "identity_only";
      }
      if (restoreResult.hasBackup && restoreResult.payload) {
        if (!relayProfile && restoreResult.payload && hasMeaningfulProfile(restoreResult.payload.profile)) {
          applyBackupProfile(restoreResult.payload.profile);
          accountSyncStatusStore.updateSnapshot({
            lastRestoreSource: "encrypted_backup",
          });
        }
        restoreStatus = "private_restored";
        restoredBackupAtUnixMs = Date.now();
        latestBackupEventId = restoreResult.event?.id;
      }
    } catch (error) {
      degradedReason = error instanceof Error ? error.message : String(error);
      restoreStatus = relayProfile ? "degraded" : "identity_only";
    }

    accountSyncStatusStore.updateSnapshot({
      phase: "syncing_messages_and_requests",
      status: restoreStatus,
      message: "Syncing messages and requests",
      lastRelayFailureReason: degradedReason,
    });

    accountSyncStatusStore.updateSnapshot({
      phase: "ready",
      status: restoreStatus,
      message: restoreStatus === "identity_only"
        ? "Identity restored, but shared account data was not found on relays"
        : restoreStatus === "degraded"
          ? "Account restore degraded"
          : "Account sync ready",
    });

    return {
      publicProfile: relayProfile,
      relayList,
      restoreStatus,
      restoredBackupAtUnixMs,
      latestBackupEventId,
      latestProfileEventId: profileEvent?.id,
      latestRelayListEventId: relayListEvent?.id,
      degradedReason,
    };
  },
};

export const accountRehydrateServiceInternals = {
  applyRelayProfile,
  fetchLatestOwnEvent,
  parseProfileEvent,
  parseRelayListFromEvent,
};
