"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { seedProfileMetadataCache } from "@/app/features/profile/hooks/use-profile-metadata";
import { useProfilePublisher } from "@/app/features/profile/hooks/use-profile-publisher";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useRelayPoolRef } from "@/app/features/relays/hooks/use-relay-pool-ref";
import { resolveNip05 } from "@/app/features/profile/utils/nip05-resolver";
import { useUserInviteCode } from "@/app/features/invites/hooks/use-user-invite-code";
import { queryRelayProfiles } from "@/app/features/search/services/relay-discovery-query";
import {
  INVITE_CODE_PREFIX,
  INVITE_CODE_SUFFIX_LENGTH,
  buildInviteCodeFromSuffix,
  extractInviteCodeSuffix,
  generateRandomInviteCode,
  isCanonicalInviteCode,
  normalizeInviteCodeSuffixInput,
} from "@/app/features/invites/utils/invite-code-format";
import { useAccountSyncSnapshot } from "@/app/features/account-sync/hooks/use-account-sync-snapshot";
import { normalizePublicKeyHex } from "@/app/features/profile/utils/normalize-public-key-hex";
import { decodePrivateKey } from "@/app/features/auth/utils/decode-private-key";
import { NATIVE_KEY_SENTINEL } from "@/app/features/crypto/crypto-service";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { SettingsActionPhase } from "@/app/features/settings/components/settings-action-status";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";
import type { InviteCodeAvailabilityStatus } from "../settings-tab-panel-shared";
import {
  validateProfileInput,
  withActionTimeout,
  PROFILE_PUBLISH_UI_TIMEOUT_MS,
  NIP05_IDENTIFIER_PATTERN,
} from "../settings-tab-panel-shared";

export function useProfileSettingsModel(): SettingsTabPanelModel {
  const { t } = useTranslation();
  const identity = useIdentity();
  const accountSyncSnapshot = useAccountSyncSnapshot();
  const profile = useProfile();
  const {
    publishProfile,
    getLastReportSnapshot: getProfilePublishReportSnapshot,
    isPublishing,
    phase: profilePublishPhase,
    lastReport: profilePublishReport,
    error: profilePublishError,
  } = useProfilePublisher();
  const { relayPool: pool } = useRelay();
  const poolRef = useRelayPoolRef(pool);
  const displayPublicKeyHex: string = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
  const publicKeyHex: PublicKeyHex | null = (displayPublicKeyHex as PublicKeyHex | null) ?? null;
  const userInviteCode = useUserInviteCode({
    publicKeyHex,
    privateKeyHex: identity.state.privateKeyHex || null,
  });

  const [isVerifyingNip05, setIsVerifyingNip05] = useState(false);
  const [profileSaveActionPhase, setProfileSaveActionPhase] = useState<SettingsActionPhase>("idle");
  const [profileSaveActionMessage, setProfileSaveActionMessage] = useState<string>("");
  const [profilePreflightError, setProfilePreflightError] = useState<string | null>(null);
  const [inviteCodeAvailabilityStatus, setInviteCodeAvailabilityStatus] = useState<InviteCodeAvailabilityStatus>("idle");
  const [inviteCodeAvailabilityMessage, setInviteCodeAvailabilityMessage] = useState<string>("");

  const persistedInviteCodeSuffix = useMemo(
    () => extractInviteCodeSuffix(profile.state.profile.inviteCode),
    [profile.state.profile.inviteCode],
  );
  const [inviteCodeDraftSuffix, setInviteCodeDraftSuffix] = useState<string>(() => persistedInviteCodeSuffix);
  const [isInviteCodeDraftDirty, setIsInviteCodeDraftDirty] = useState<boolean>(false);
  const inviteCodeDraft = useMemo(() => buildInviteCodeFromSuffix(inviteCodeDraftSuffix), [inviteCodeDraftSuffix]);

  const profileValidation = useMemo(() => validateProfileInput({
    username: profile.state.profile.username,
    about: profile.state.profile.about,
    nip05: profile.state.profile.nip05,
    avatarUrl: profile.state.profile.avatarUrl,
    inviteCode: inviteCodeDraft,
  }), [inviteCodeDraft, profile.state.profile.username, profile.state.profile.about, profile.state.profile.nip05, profile.state.profile.avatarUrl]);

  const setInviteCodeFromSuffix = useCallback((suffixInput: string): void => {
    const suffix = normalizeInviteCodeSuffixInput(suffixInput);
    setInviteCodeDraftSuffix(suffix);
    setIsInviteCodeDraftDirty(suffix !== persistedInviteCodeSuffix);
    setInviteCodeAvailabilityStatus("idle");
    setInviteCodeAvailabilityMessage("");
  }, [persistedInviteCodeSuffix]);

  const verifyInviteCodeAvailability = useCallback(async (
    inviteCode: string,
  ): Promise<Exclude<InviteCodeAvailabilityStatus, "idle" | "checking">> => {
    if (!inviteCode || !isCanonicalInviteCode(inviteCode)) {
      setInviteCodeAvailabilityStatus("idle");
      setInviteCodeAvailabilityMessage("");
      return "unverified";
    }
    setInviteCodeAvailabilityStatus("checking");
    setInviteCodeAvailabilityMessage("Checking code availability...");
    try {
      const relayPool = poolRef.current;
      const [inviteResult, textResult] = await Promise.allSettled([
        queryRelayProfiles({ pool: relayPool, mode: "invite", query: inviteCode, timeoutMs: 4_500, maxResults: 48 }),
        queryRelayProfiles({ pool: relayPool, mode: "text", query: inviteCode, timeoutMs: 4_500, maxResults: 48 }),
      ]);
      if (inviteResult.status === "rejected" && textResult.status === "rejected") {
        throw new Error("invite_code_lookup_failed");
      }
      const recordsByPubkey = new Map<string, Awaited<ReturnType<typeof queryRelayProfiles>>[number]>();
      if (inviteResult.status === "fulfilled") {
        for (const record of inviteResult.value) {
          recordsByPubkey.set(record.pubkey, record);
        }
      }
      if (textResult.status === "fulfilled") {
        for (const record of textResult.value) {
          recordsByPubkey.set(record.pubkey, record);
        }
      }
      const records = Array.from(recordsByPubkey.values());
      const exactMatches = records.filter((record) => (record.inviteCode ?? "").toUpperCase() === inviteCode.toUpperCase());
      const normalizedSelfPubkey = normalizePublicKeyHex(publicKeyHex ?? undefined);
      const claimedByOther = exactMatches.some((record) => normalizePublicKeyHex(record.pubkey) !== normalizedSelfPubkey);
      if (claimedByOther) {
        setInviteCodeAvailabilityStatus("claimed_by_other");
        setInviteCodeAvailabilityMessage("This code is already claimed. Try Random.");
        return "claimed_by_other";
      }
      setInviteCodeAvailabilityStatus("available");
      setInviteCodeAvailabilityMessage(exactMatches.length > 0 ? "This code is already linked to your account." : "This code appears available.");
      return "available";
    } catch {
      setInviteCodeAvailabilityStatus("unverified");
      setInviteCodeAvailabilityMessage("Could not verify code availability. Check network/relays and retry.");
      return "unverified";
    }
  }, [poolRef, publicKeyHex]);

  const handleRandomInviteCode = useCallback(async (): Promise<void> => {
    setProfilePreflightError(null);
    const candidate = generateRandomInviteCode();
    const candidateSuffix = extractInviteCodeSuffix(candidate);
    setInviteCodeDraftSuffix(candidateSuffix);
    setIsInviteCodeDraftDirty(candidateSuffix !== persistedInviteCodeSuffix);
    setInviteCodeAvailabilityStatus("idle");
    setInviteCodeAvailabilityMessage("");
    toast.success("Random code generated.");
  }, [persistedInviteCodeSuffix]);

  useEffect(() => {
    if (!isInviteCodeDraftDirty) {
      setInviteCodeDraftSuffix(persistedInviteCodeSuffix);
    }
  }, [isInviteCodeDraftDirty, persistedInviteCodeSuffix]);

  useEffect(() => {
    if (profilePreflightError) {
      setProfilePreflightError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileValidation.isValid, profile.state.profile.username, profile.state.profile.about, profile.state.profile.nip05, profile.state.profile.avatarUrl, inviteCodeDraft]);

  const profileRevertRef = useRef(profile.revert);
  profileRevertRef.current = profile.revert;
  useEffect(() => {
    return () => {
      profileRevertRef.current();
    };
  }, []);

  const resolveActivePrivateKeyHex = async (): Promise<PrivateKeyHex | null> => {
    if (identity.state.privateKeyHex && identity.state.privateKeyHex !== NATIVE_KEY_SENTINEL) {
      return identity.state.privateKeyHex;
    }
    if (identity.state.privateKeyHex !== NATIVE_KEY_SENTINEL) {
      return null;
    }
    const nsecResult = await invokeNativeCommand<string>("get_session_nsec");
    if (!nsecResult.ok || !nsecResult.value) {
      return null;
    }
    return decodePrivateKey(nsecResult.value);
  };

  const handleVerifyNip05 = async (): Promise<void> => {
    const identifier = (profile.state.profile.nip05 || "").trim();
    if (!identifier || !NIP05_IDENTIFIER_PATTERN.test(identifier)) {
      toast.error("Please enter a valid identifier (name@domain.tld)");
      return;
    }
    setIsVerifyingNip05(true);
    try {
      const result = await resolveNip05(identifier);
      if (result.ok) {
        if (result.publicKeyHex === displayPublicKeyHex) {
          toast.success("NIP-05 identifier verified successfully!");
        } else {
          toast.warning("NIP-05 verified, but it belongs to a different public key!");
        }
      } else {
        toast.error(`Verification failed: ${result.reason}`);
      }
    } catch {
      toast.error("An error occurred during verification");
    } finally {
      setIsVerifyingNip05(false);
    }
  };

  const handleSaveProfile = async (): Promise<void> => {
    setProfilePreflightError(null);
    if (!profileValidation.isValid) {
      const firstError = profileValidation.usernameError || profileValidation.aboutError || profileValidation.nip05Error || profileValidation.avatarUrlError || profileValidation.inviteCodeError || "Please fix profile validation errors.";
      setProfilePreflightError(firstError);
      setProfileSaveActionPhase("error");
      setProfileSaveActionMessage(firstError);
      toast.error(firstError);
      return;
    }

    const normalizedInviteCode = inviteCodeDraft.trim().toUpperCase();
    if (normalizedInviteCode !== profile.state.profile.inviteCode) {
      profile.setInviteCode({ inviteCode: normalizedInviteCode });
    }
    if (normalizedInviteCode.length > 0) {
      setProfileSaveActionPhase("working");
      setProfileSaveActionMessage("Validating friend code...");
      const availability = await verifyInviteCodeAvailability(normalizedInviteCode);
      if (availability === "claimed_by_other") {
        const message = "This friend code is already claimed by another account.";
        setProfilePreflightError(message);
        setProfileSaveActionPhase("error");
        setProfileSaveActionMessage(message);
        toast.error(message);
        return;
      }
      if (availability === "unverified") {
        const message = "Unable to verify friend code uniqueness right now. Please retry.";
        setProfilePreflightError(message);
        setProfileSaveActionPhase("error");
        setProfileSaveActionMessage(message);
        toast.error(message);
        return;
      }
    }

    profile.save();
    setIsInviteCodeDraftDirty(false);
    if (publicKeyHex) {
      discoveryCache.upsertProfile({
        pubkey: publicKeyHex,
        name: profile.state.profile.username.trim() || undefined,
        displayName: profile.state.profile.username.trim() || undefined,
        about: profile.state.profile.about?.trim() || undefined,
        picture: profile.state.profile.avatarUrl?.trim() || undefined,
        nip05: profile.state.profile.nip05?.trim() || undefined,
        inviteCode: normalizedInviteCode || undefined,
      });
      seedProfileMetadataCache({
        pubkey: publicKeyHex,
        displayName: profile.state.profile.username.trim() || undefined,
        avatarUrl: profile.state.profile.avatarUrl?.trim() || undefined,
        about: profile.state.profile.about?.trim() || undefined,
        nip05: profile.state.profile.nip05?.trim() || undefined,
      });
    }
    setProfileSaveActionPhase("working");
    setProfileSaveActionMessage("Saving profile and publishing it to relays...");
    const timedOutMessage = "Save finished on this device, but relay publishing timed out. Obscur will keep your saved profile.";
    const publishOperation = publishProfile({
      username: profile.state.profile.username.trim(),
      about: profile.state.profile.about,
      avatarUrl: profile.state.profile.avatarUrl?.trim(),
      nip05: profile.state.profile.nip05?.trim(),
      inviteCode: normalizedInviteCode,
    });
    const publishResult = await withActionTimeout(
      publishOperation,
      PROFILE_PUBLISH_UI_TIMEOUT_MS,
      timedOutMessage,
    ).catch((error) => {
      const message = error instanceof Error ? error.message : "Failed to publish profile.";
      if (message === timedOutMessage) {
        setProfileSaveActionPhase("working");
        setProfileSaveActionMessage("Profile saved locally. Global publish is still running in the background.");
        toast.info("Profile saved locally. Relay publish is still in progress.");
        return "timed_out" as const;
      }
      setProfileSaveActionPhase("error");
      setProfileSaveActionMessage(message);
      toast.error(message);
      return false;
    });

    if (publishResult === "timed_out") {
      void publishOperation.then((finalSuccess) => {
        if (finalSuccess) {
          setProfileSaveActionPhase("success");
          setProfileSaveActionMessage("Profile saved and published to the network.");
          toast.success(t("settings.profileSaved"));
          return;
        }
        const latestPublishReport = getProfilePublishReportSnapshot();
        if (latestPublishReport?.deliveryStatus === "queued") {
          const message = latestPublishReport.message || "Profile is saved on this device, but relay publishing needs a healthier connection.";
          setProfileSaveActionPhase("error");
          setProfileSaveActionMessage(message);
          toast.warning(message);
          return;
        }
        const message = profilePublishError || "Profile publish failed.";
        setProfileSaveActionPhase("error");
        setProfileSaveActionMessage(message);
        toast.error(t("settings.profilePublishFailed"));
      }).catch((error) => {
        const message = error instanceof Error ? error.message : "Failed to publish profile.";
        setProfileSaveActionPhase("error");
        setProfileSaveActionMessage(message);
        toast.error(message);
      });
      return;
    }

    if (publishResult) {
      setProfileSaveActionPhase("success");
      setProfileSaveActionMessage("Profile saved and published to the network.");
      toast.success(t("settings.profileSaved"));
      return;
    }
    const latestPublishReport = getProfilePublishReportSnapshot();
    if (latestPublishReport?.deliveryStatus === "queued") {
      const message = latestPublishReport.message || "Profile is saved on this device, but relay publishing needs a healthier connection.";
      setProfileSaveActionPhase("error");
      setProfileSaveActionMessage(message);
      toast.warning(message);
      return;
    }
    setProfileSaveActionPhase("error");
    setProfileSaveActionMessage(profilePublishError || "Profile publish failed.");
    toast.error(t("settings.profilePublishFailed"));
  };

  return {
    INVITE_CODE_PREFIX,
    INVITE_CODE_SUFFIX_LENGTH,
    accountSyncSnapshot,
    getProfilePublishReportSnapshot,
    handleRandomInviteCode,
    handleSaveProfile,
    handleVerifyNip05,
    inviteCodeAvailabilityMessage,
    inviteCodeAvailabilityStatus,
    inviteCodeDraft,
    inviteCodeDraftSuffix,
    isInviteCodeDraftDirty,
    isPublishing,
    isVerifyingNip05,
    persistedInviteCodeSuffix,
    profile,
    profilePreflightError,
    profilePublishError,
    profilePublishPhase,
    profilePublishReport,
    profileSaveActionMessage,
    profileSaveActionPhase,
    profileValidation,
    publicKeyHex,
    resolveActivePrivateKeyHex,
    setInviteCodeAvailabilityMessage,
    setInviteCodeAvailabilityStatus,
    setInviteCodeDraftSuffix,
    setInviteCodeFromSuffix,
    setIsInviteCodeDraftDirty,
    setIsVerifyingNip05,
    setProfilePreflightError,
    setProfileSaveActionMessage,
    setProfileSaveActionPhase,
    t,
    userInviteCode,
    verifyInviteCodeAvailability,
  };
}
