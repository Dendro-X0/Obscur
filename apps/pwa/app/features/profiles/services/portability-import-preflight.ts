import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { getResolvedProfileId } from "./profile-runtime-scope";
import { desktopProfileRuntime } from "./desktop-profile-runtime";
import {
  localSaveOccupancyIsBlocked,
  localSaveOccupancyLabelKey,
  resolveLocalSaveAccountOccupancy,
  type LocalSaveAccountOccupancy,
} from "./local-save-account-occupancy";
import type { PortableAccountBundle } from "@/app/features/account-sync/account-sync-contracts";
import { summarizePersistedChatStateMessages } from "@/app/features/account-sync/services/restore-hydrate-indexed-messages";
import {
  decryptEncryptedWorkspaceBundlePayload,
  parseEncryptedWorkspaceBundleEnvelope,
} from "./encrypted-workspace-bundle-service";
import type { PortabilityExportKind } from "./portability-export-history";
import { parsePortableOrUnifiedImportEnvelope } from "./unified-account-export-service";
import {
  parseCommunityMembershipLedgerSnapshot,
  summarizeCommunityMembershipLedger,
} from "@/app/features/groups/services/community-membership-ledger";

export type PortabilityImportAccountMatch = "match" | "mismatch" | "unknown";

export type PortabilityImportPreflight = Readonly<{
  kind: PortabilityExportKind;
  fileName: string;
  bundlePublicKeyHex: string | null;
  accountMatch: PortabilityImportAccountMatch;
  exportedAtUnixMs: number | null;
  bundleAgeLabel: string;
  scopeItems: ReadonlyArray<Readonly<{ label: string; value: string; valueParams?: Readonly<Record<string, string>> }>>;
  warnings: ReadonlyArray<string>;
  canProceed: boolean;
  /** Valid backup selected before sign-in; can be staged until unlock. */
  canStageForSignIn: boolean;
}>;

const PORTABLE_ACCOUNT_BUNDLE_FORMAT = "obscur.portable_account_bundle.v1";

const parsePortableAccountBundleEnvelope = (value: unknown): PortableAccountBundle | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const parsed = value as Partial<PortableAccountBundle>;
  if (
    parsed.version !== 1
    || parsed.format !== PORTABLE_ACCOUNT_BUNDLE_FORMAT
    || typeof parsed.publicKeyHex !== "string"
    || typeof parsed.ciphertext !== "string"
    || typeof parsed.exportedAtUnixMs !== "number"
  ) {
    return null;
  }
  return parsed as PortableAccountBundle;
};

const formatBundleAge = (exportedAtUnixMs: number | null): string => {
  if (!exportedAtUnixMs || !Number.isFinite(exportedAtUnixMs)) {
    return "Unknown age";
  }
  const ageMs = Math.max(0, Date.now() - exportedAtUnixMs);
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) {
    return "Just now";
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const resolveAccountMatch = (
  bundlePublicKeyHex: string | null,
  activePublicKeyHex: PublicKeyHex | null,
): PortabilityImportAccountMatch => {
  if (!bundlePublicKeyHex || !activePublicKeyHex) {
    return "unknown";
  }
  return bundlePublicKeyHex.trim().toLowerCase() === activePublicKeyHex.trim().toLowerCase()
    ? "match"
    : "mismatch";
};

const resolveCanStageForSignIn = (params: Readonly<{
  bundlePublicKeyHex: string | null;
  activePublicKeyHex: PublicKeyHex | null;
  warnings: ReadonlyArray<string>;
}>): boolean => {
  if (params.activePublicKeyHex || !params.bundlePublicKeyHex) {
    return false;
  }
  return !params.warnings.some((warning) => (
    warning.includes("not a valid")
    || warning.includes("could not be read")
    || warning.includes("format is invalid")
    || warning.includes("different account in this window")
    || warning.includes("already has a different account")
    || warning.includes("already unlocked in profile")
    || warning.includes("already belongs to profile")
  ));
};

const appendProfileSlotOccupancyPreflight = async (
  warnings: string[],
  scopeItems: Array<{ label: string; value: string; valueParams?: Readonly<Record<string, string>> }>,
  bundlePublicKeyHex: PublicKeyHex,
): Promise<LocalSaveAccountOccupancy> => {
  const profiles = await desktopProfileRuntime.listProfiles();
  const occupancy = resolveLocalSaveAccountOccupancy({
    publicKeyHex: bundlePublicKeyHex,
    currentProfileId: getResolvedProfileId(),
    profiles,
  });
  scopeItems.push({
    label: "profiles.portability.preflight.localDeviceStatus",
    value: localSaveOccupancyLabelKey(occupancy),
    ...(occupancy.kind === "other_slot" || occupancy.kind === "active_in_other_window"
      ? { valueParams: { profileLabel: occupancy.profileLabel } }
      : {}),
  });
  if (occupancy.kind === "this_slot_conflict") {
    warnings.push(
      "This profile window already has a different account. Open another profile window, or export and reset this window before restoring this backup.",
    );
  } else if (occupancy.kind === "active_in_other_window") {
    warnings.push(
      `This account is already unlocked in profile "${occupancy.profileLabel}". Sign out there first, or reset that window before restoring here.`,
    );
  } else if (occupancy.kind === "other_slot") {
    warnings.push(
      `This account already belongs to profile "${occupancy.profileLabel}". Each profile window can hold one account — export and reset this window, or switch to that profile window.`,
    );
  } else if (occupancy.kind === "this_slot_match") {
    warnings.push("This account already exists on this device. Unlock with your credentials to import the backup.");
  }
  return occupancy;
};

export const preflightPortableAccountImport = async (params: Readonly<{
  file: File;
  activePublicKeyHex: PublicKeyHex | null;
  privateKeyHex?: PrivateKeyHex | null;
}>): Promise<PortabilityImportPreflight> => {
  const warnings: string[] = [];
  let scopeItems: Array<{ label: string; value: string }> = [];
  let bundle: PortableAccountBundle | null = null;

  try {
    bundle = parsePortableAccountBundleEnvelope(JSON.parse(await params.file.text()));
  } catch {
    return {
      kind: "portable_account",
      fileName: params.file.name,
      bundlePublicKeyHex: null,
      accountMatch: "unknown",
      exportedAtUnixMs: null,
      bundleAgeLabel: "Unknown age",
      scopeItems: [],
      warnings: ["File is not a valid portable account bundle."],
      canProceed: false,
      canStageForSignIn: false,
    };
  }

  if (!bundle) {
    return {
      kind: "portable_account",
      fileName: params.file.name,
      bundlePublicKeyHex: null,
      accountMatch: "unknown",
      exportedAtUnixMs: null,
      bundleAgeLabel: "Unknown age",
      scopeItems: [],
      warnings: ["Portable bundle format is invalid."],
      canProceed: false,
      canStageForSignIn: false,
    };
  }

  const accountMatch = resolveAccountMatch(bundle.publicKeyHex, params.activePublicKeyHex);
  if (accountMatch === "mismatch") {
    warnings.push("Bundle belongs to a different account than the one unlocked in this window.");
  }

  if (params.privateKeyHex && accountMatch === "match") {
    try {
      const { encryptedAccountBackupService } = await import("@/app/features/account-sync/services/encrypted-account-backup-service");
      const { cryptoService } = await import("@/app/features/crypto/crypto-service");
      const plaintext = await cryptoService.decryptDM(
        bundle.ciphertext,
        params.activePublicKeyHex as PublicKeyHex,
        params.privateKeyHex,
      );
      const payload = JSON.parse(plaintext) as {
        relayList?: ReadonlyArray<{ enabled: boolean }>;
        chatState?: unknown;
        communityMembershipLedger?: ReadonlyArray<unknown>;
        profile?: { username?: string };
      };
      const chatDiagnostics = summarizePersistedChatStateMessages(
        payload.chatState as Parameters<typeof summarizePersistedChatStateMessages>[0],
        params.activePublicKeyHex as PublicKeyHex,
      );
      const membershipSummary = summarizeCommunityMembershipLedger(
        parseCommunityMembershipLedgerSnapshot(payload.communityMembershipLedger),
      );
      const communitiesValue = membershipSummary.archivedCount > 0
        ? `${membershipSummary.joinedCount} active`
        : `${membershipSummary.joinedCount} memberships`;
      const communitiesDetail = membershipSummary.archivedCount > 0
        ? `${membershipSummary.archivedCount} archived (${membershipSummary.totalCount} stored)`
        : undefined;
      scopeItems = [
        { label: "Profile", value: payload.profile?.username?.trim() || "Unnamed account" },
        {
          label: "Relays",
          value: `${payload.relayList?.filter((relay) => relay.enabled).length ?? 0} enabled`,
        },
        {
          label: "Messages",
          value: `${chatDiagnostics.dmMessageCount + chatDiagnostics.groupMessageCount} total`,
        },
        {
          label: "Communities",
          value: communitiesDetail ? `${communitiesValue} (${communitiesDetail})` : communitiesValue,
        },
      ];
    } catch {
      warnings.push("Bundle could not be decrypted with the active account key.");
    }
  } else {
    scopeItems = [
      { label: "Bundle account", value: `${bundle.publicKeyHex.slice(0, 8)}…` },
      { label: "Restore scope", value: "Account backup envelope" },
    ];
    if (!params.privateKeyHex) {
      warnings.push("Unlock this account to preview decrypted restore scope.");
    }
  }

  if (bundle.profileLabel?.trim()) {
    scopeItems.unshift({ label: "Username", value: bundle.profileLabel.trim() });
  }
  await appendProfileSlotOccupancyPreflight(warnings, scopeItems, bundle.publicKeyHex);

  return {
    kind: "portable_account",
    fileName: params.file.name,
    bundlePublicKeyHex: bundle.publicKeyHex,
    accountMatch,
    exportedAtUnixMs: bundle.exportedAtUnixMs,
    bundleAgeLabel: formatBundleAge(bundle.exportedAtUnixMs),
    scopeItems,
    warnings,
    canProceed: accountMatch === "match" && warnings.every((warning) => !warning.includes("could not be decrypted")),
    canStageForSignIn: resolveCanStageForSignIn({
      bundlePublicKeyHex: bundle.publicKeyHex,
      activePublicKeyHex: params.activePublicKeyHex,
      warnings,
    }),
  };
};

export const preflightUnifiedAccountImport = async (params: Readonly<{
  file: File;
  activePublicKeyHex: PublicKeyHex | null;
  privateKeyHex?: PrivateKeyHex | null;
}>): Promise<PortabilityImportPreflight> => {
  const warnings: string[] = [];
  let scopeItems: Array<{ label: string; value: string }> = [];

  try {
    const parsed = parsePortableOrUnifiedImportEnvelope(JSON.parse(await params.file.text()));
    if (!parsed) {
      return {
        kind: "unified_account",
        fileName: params.file.name,
        bundlePublicKeyHex: null,
        accountMatch: "unknown",
        exportedAtUnixMs: null,
        bundleAgeLabel: "Unknown age",
        scopeItems: [],
        warnings: ["File is not a valid unified account export or portable bundle."],
        canProceed: false,
        canStageForSignIn: false,
      };
    }

    const bundlePublicKeyHex = parsed.kind === "unified"
      ? parsed.envelope.publicKeyHex
      : parsed.bundle.publicKeyHex;
    const exportedAtUnixMs = parsed.kind === "unified"
      ? parsed.envelope.exportedAtUnixMs
      : parsed.bundle.exportedAtUnixMs;
    const accountMatch = resolveAccountMatch(bundlePublicKeyHex, params.activePublicKeyHex);
    if (accountMatch === "mismatch") {
      warnings.push("Export belongs to a different account than the one unlocked in this window.");
    }
    if (!params.activePublicKeyHex) {
      warnings.push(`Sign in with the account from this backup (${bundlePublicKeyHex.slice(0, 8)}…), then confirm import.`);
    }

    scopeItems = [
      { label: "Export type", value: parsed.kind === "unified" ? "Unified account + workspace" : "Portable account only" },
      { label: "Bundle account", value: `${bundlePublicKeyHex.slice(0, 8)}…` },
    ];
    if (parsed.kind === "unified") {
      scopeItems = [
        ...scopeItems,
        {
          label: "Workspace / vault",
          value: parsed.envelope.workspaceBundle
            ? (parsed.envelope.manifest.includesVaultMedia ? "Included" : "Settings + network")
            : "Account data only",
        },
      ];
    }

    if (params.privateKeyHex && accountMatch === "match" && parsed.kind === "unified") {
      const portablePreflight = await preflightPortableAccountImport({
        file: new File([JSON.stringify(parsed.envelope.portableAccountBundle)], "nested-portable.json"),
        activePublicKeyHex: params.activePublicKeyHex,
        privateKeyHex: params.privateKeyHex,
      });
      scopeItems = portablePreflight.scopeItems.length > 0 ? [...portablePreflight.scopeItems] : scopeItems;
      warnings.push(...portablePreflight.warnings.filter((warning) => !warning.includes("valid portable")));
      if (parsed.envelope.workspaceBundle) {
        warnings.push("Import restores account data and this profile window's workspace snapshot. Reload recommended.");
      }
    } else if (!params.privateKeyHex && params.activePublicKeyHex) {
      warnings.push("Unlock this account to preview decrypted restore scope.");
    }

    const profileLabel = parsed.kind === "unified"
      ? parsed.envelope.profileLabel?.trim() || parsed.envelope.portableAccountBundle.profileLabel?.trim()
      : parsed.bundle.profileLabel?.trim();
    if (profileLabel) {
      scopeItems.unshift({ label: "Username", value: profileLabel });
    }
    await appendProfileSlotOccupancyPreflight(warnings, scopeItems, bundlePublicKeyHex as PublicKeyHex);

    return {
      kind: "unified_account",
      fileName: params.file.name,
      bundlePublicKeyHex,
      accountMatch,
      exportedAtUnixMs,
      bundleAgeLabel: formatBundleAge(exportedAtUnixMs),
      scopeItems,
      warnings,
      canProceed: Boolean(params.activePublicKeyHex)
        && accountMatch === "match"
        && !warnings.some((warning) => warning.includes("could not be decrypted")),
      canStageForSignIn: resolveCanStageForSignIn({
        bundlePublicKeyHex,
        activePublicKeyHex: params.activePublicKeyHex,
        warnings,
      }),
    };
  } catch {
    return {
      kind: "unified_account",
      fileName: params.file.name,
      bundlePublicKeyHex: null,
      accountMatch: "unknown",
      exportedAtUnixMs: null,
      bundleAgeLabel: "Unknown age",
      scopeItems: [],
      warnings: ["File could not be read or parsed."],
      canProceed: false,
      canStageForSignIn: false,
    };
  }
};

export const preflightWorkspaceBundleImport = async (params: Readonly<{
  file: File;
  activePublicKeyHex: PublicKeyHex | null;
  privateKeyHex?: PrivateKeyHex | null;
}>): Promise<PortabilityImportPreflight> => {
  const warnings: string[] = [];
  let scopeItems: Array<{ label: string; value: string }> = [];
  let envelope = null;

  try {
    envelope = parseEncryptedWorkspaceBundleEnvelope(JSON.parse(await params.file.text()));
  } catch {
    return {
      kind: "workspace_bundle",
      fileName: params.file.name,
      bundlePublicKeyHex: null,
      accountMatch: "unknown",
      exportedAtUnixMs: null,
      bundleAgeLabel: "Unknown age",
      scopeItems: [],
      warnings: ["File is not a valid encrypted workspace bundle."],
      canProceed: false,
      canStageForSignIn: false,
    };
  }

  if (!envelope) {
    return {
      kind: "workspace_bundle",
      fileName: params.file.name,
      bundlePublicKeyHex: null,
      accountMatch: "unknown",
      exportedAtUnixMs: null,
      bundleAgeLabel: "Unknown age",
      scopeItems: [],
      warnings: ["Encrypted workspace bundle format is invalid."],
      canProceed: false,
      canStageForSignIn: false,
    };
  }

  const accountMatch = resolveAccountMatch(envelope.publicKeyHex, params.activePublicKeyHex);
  if (accountMatch === "mismatch") {
    warnings.push("Bundle belongs to a different account than the one unlocked in this window.");
  }

  scopeItems = [
    { label: "Profile window", value: envelope.profileId },
    { label: "Bundle account", value: `${envelope.publicKeyHex.slice(0, 8)}…` },
  ];

  if (params.privateKeyHex && accountMatch === "match") {
    try {
      const payload = await decryptEncryptedWorkspaceBundlePayload({
        envelope,
        publicKeyHex: params.activePublicKeyHex as PublicKeyHex,
        privateKeyHex: params.privateKeyHex,
      });
      const chatDiagnostics = summarizePersistedChatStateMessages(
        payload.networkSnapshot.chatStateJson ? JSON.parse(payload.networkSnapshot.chatStateJson) : null,
        params.activePublicKeyHex as PublicKeyHex,
      );
      const membershipSummary = summarizeCommunityMembershipLedger(
        parseCommunityMembershipLedgerSnapshot(
          payload.networkSnapshot.membershipLedgerJson
            ? JSON.parse(payload.networkSnapshot.membershipLedgerJson)
            : [],
        ),
      );
      const communitiesValue = membershipSummary.archivedCount > 0
        ? `${membershipSummary.joinedCount} active`
        : `${membershipSummary.joinedCount} memberships`;
      const communitiesDetail = membershipSummary.archivedCount > 0
        ? `${membershipSummary.archivedCount} archived (${membershipSummary.totalCount} stored)`
        : undefined;
      scopeItems = [
        { label: "Profile window", value: payload.profileLabel?.trim() || payload.profileId },
        {
          label: "Messages",
          value: `${chatDiagnostics.dmMessageCount + chatDiagnostics.groupMessageCount} total`,
        },
        {
          label: "Communities",
          value: communitiesDetail ? `${communitiesValue} (${communitiesDetail})` : communitiesValue,
        },
        {
          label: "Vault media",
          value: payload.includesVaultMedia ? `${payload.vaultMediaFiles?.length ?? 0} files` : "Excluded",
        },
        { label: "Settings", value: "Theme, privacy, UI, vault config" },
      ];
      warnings.push("Import replaces scoped workspace data for this profile window. Reload recommended after import.");
    } catch {
      warnings.push("Bundle could not be decrypted with the active account key.");
    }
  } else if (!params.privateKeyHex) {
    warnings.push("Unlock this account to preview decrypted restore scope.");
  }

  return {
    kind: "workspace_bundle",
    fileName: params.file.name,
    bundlePublicKeyHex: envelope.publicKeyHex,
    accountMatch,
    exportedAtUnixMs: envelope.exportedAtUnixMs,
    bundleAgeLabel: formatBundleAge(envelope.exportedAtUnixMs),
    scopeItems,
    warnings,
    canProceed: accountMatch === "match" && !warnings.some((warning) => warning.includes("could not be decrypted")),
    canStageForSignIn: resolveCanStageForSignIn({
      bundlePublicKeyHex: envelope.publicKeyHex,
      activePublicKeyHex: params.activePublicKeyHex,
      warnings,
    }),
  };
};
