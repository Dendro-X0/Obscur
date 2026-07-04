import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { encryptedAccountBackupService } from "@/app/features/account-sync/services/encrypted-account-backup-service";
import { summarizePersistedChatStateMessages } from "@/app/features/account-sync/services/restore-hydrate-indexed-messages";
import { getLocalMediaIndexSnapshot } from "@/app/features/vault/services/local-media-store";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  buildEncryptedWorkspaceBundlePayload,
} from "./encrypted-workspace-bundle-service";
import type { EncryptedWorkspaceBundleExportOptions } from "./encrypted-workspace-bundle-contracts";
import { summarizeCommunityMembershipLedger } from "@/app/features/groups/services/community-membership-ledger";

export type PortabilityExportManifestItem = Readonly<{
  label: string;
  value: string;
  detail?: string;
}>;

export type PortabilityExportManifest = Readonly<{
  kind: "portable_account" | "workspace_bundle";
  items: ReadonlyArray<PortabilityExportManifestItem>;
  estimatedSizeBytes: number;
  generatedAtUnixMs: number;
}>;

const formatBytes = (bytes: number): string => {
  if (bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[exponent]}`;
};

const estimateVaultMedia = (params: Readonly<{
  includeVaultMedia: boolean;
  maxVaultFileBytes: number;
  maxVaultTotalBytes: number;
}>): Readonly<{ fileCount: number; totalBytes: number }> => {
  if (!params.includeVaultMedia || !hasNativeRuntime()) {
    return { fileCount: 0, totalBytes: 0 };
  }
  const index = getLocalMediaIndexSnapshot();
  let fileCount = 0;
  let totalBytes = 0;
  for (const entry of Object.values(index)) {
    if (entry.size > params.maxVaultFileBytes) {
      continue;
    }
    if (totalBytes + entry.size > params.maxVaultTotalBytes) {
      break;
    }
    fileCount += 1;
    totalBytes += entry.size;
  }
  return { fileCount, totalBytes };
};

export const buildPortableAccountExportManifest = async (
  publicKeyHex: PublicKeyHex,
): Promise<PortabilityExportManifest> => {
  const payload = await encryptedAccountBackupService.buildBackupPayloadWithHydratedChatState(publicKeyHex);
  const chatDiagnostics = summarizePersistedChatStateMessages(payload.chatState, publicKeyHex);
  const enabledRelays = payload.relayList.filter((relay: { enabled: boolean }) => relay.enabled).length;
  const serialized = JSON.stringify(payload);
  const membershipSummary = summarizeCommunityMembershipLedger(payload.communityMembershipLedger ?? []);
  const communitiesValue = membershipSummary.archivedCount > 0
    ? `${membershipSummary.joinedCount} active`
    : `${membershipSummary.joinedCount} memberships`;
  const communitiesDetail = membershipSummary.archivedCount > 0
    ? `${membershipSummary.archivedCount} archived (${membershipSummary.totalCount} stored)`
    : undefined;
  return {
    kind: "portable_account",
    generatedAtUnixMs: Date.now(),
    estimatedSizeBytes: serialized.length,
    items: [
      { label: "Profile", value: payload.profile.username?.trim() || "Unnamed account" },
      { label: "Relays", value: `${enabledRelays} enabled`, detail: `${payload.relayList.length} total configured` },
      {
        label: "Direct messages",
        value: `${chatDiagnostics.dmMessageCount} messages`,
        detail: `${chatDiagnostics.dmCanonicalConversationCount} conversations`,
      },
      {
        label: "Group messages",
        value: `${chatDiagnostics.groupMessageCount} messages`,
        detail: `${chatDiagnostics.groupConversationCount} conversations`,
      },
      {
        label: "Communities",
        value: communitiesValue,
        detail: communitiesDetail,
      },
      {
        label: "Contacts & trust",
        value: `${payload.peerTrust.acceptedPeers.length} accepted peers`,
        detail: `${payload.requestOutbox.records.length} pending outbox`,
      },
      {
        label: "Estimated export size",
        value: formatBytes(serialized.length),
        detail: "Encrypted JSON bundle",
      },
    ],
  };
};

export const buildWorkspaceBundleExportManifest = async (
  params: Readonly<Omit<EncryptedWorkspaceBundleExportOptions, "privateKeyHex">>,
): Promise<PortabilityExportManifest> => {
  const payload = await buildEncryptedWorkspaceBundlePayload({
    ...params,
    privateKeyHex: "0".repeat(64),
  });
  const chatDiagnostics = summarizePersistedChatStateMessages(
    payload.networkSnapshot.chatStateJson ? JSON.parse(payload.networkSnapshot.chatStateJson) : null,
    params.publicKeyHex as PublicKeyHex,
  );
  const vaultEstimate = estimateVaultMedia({
    includeVaultMedia: Boolean(params.includeVaultMedia),
    maxVaultFileBytes: params.maxVaultFileBytes ?? 10 * 1024 * 1024,
    maxVaultTotalBytes: params.maxVaultTotalBytes ?? 100 * 1024 * 1024,
  });
  const archiveEntryCount = typeof payload.workspaceArchive === "object"
    && payload.workspaceArchive !== null
    && Array.isArray((payload.workspaceArchive as { localStorageEntries?: unknown }).localStorageEntries)
    ? (payload.workspaceArchive as { localStorageEntries: unknown[] }).localStorageEntries.length
    : 0;
  const serializedEstimate = JSON.stringify(payload).length + vaultEstimate.totalBytes;
  const membershipSummary = summarizeCommunityMembershipLedger(
    payload.networkSnapshot.membershipLedgerJson
      ? JSON.parse(payload.networkSnapshot.membershipLedgerJson) as Parameters<typeof summarizeCommunityMembershipLedger>[0]
      : [],
  );
  const communitiesValue = membershipSummary.archivedCount > 0
    ? `${membershipSummary.joinedCount} active`
    : `${membershipSummary.joinedCount} memberships`;
  const communitiesDetail = membershipSummary.archivedCount > 0
    ? `${membershipSummary.archivedCount} archived (${membershipSummary.totalCount} stored)`
    : undefined;

  return {
    kind: "workspace_bundle",
    generatedAtUnixMs: Date.now(),
    estimatedSizeBytes: serializedEstimate,
    items: [
      { label: "Profile window", value: payload.profileLabel?.trim() || payload.profileId },
      { label: "Scoped storage keys", value: `${archiveEntryCount} entries` },
      {
        label: "Direct messages",
        value: `${chatDiagnostics.dmMessageCount} messages`,
        detail: `${chatDiagnostics.dmCanonicalConversationCount} conversations`,
      },
      {
        label: "Group messages",
        value: `${chatDiagnostics.groupMessageCount} messages`,
        detail: `${chatDiagnostics.groupConversationCount} conversations`,
      },
      { label: "Communities", value: communitiesValue, detail: communitiesDetail },
      {
        label: "Settings",
        value: "Theme, privacy, UI, vault config",
        detail: payload.settingsSnapshot.themePreference ?? "system",
      },
      {
        label: "Vault media",
        value: params.includeVaultMedia ? `${vaultEstimate.fileCount} files` : "Excluded",
        detail: params.includeVaultMedia ? formatBytes(vaultEstimate.totalBytes) : "Toggle on to include cached files",
      },
      {
        label: "Estimated export size",
        value: formatBytes(serializedEstimate),
        detail: "Compressed + encrypted bundle",
      },
    ],
  };
};
