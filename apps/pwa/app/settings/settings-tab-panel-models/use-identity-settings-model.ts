"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { nip19 } from "nostr-tools";
import { useTranslation } from "react-i18next";
import { toast } from "@dweb/ui-kit";
import { useAppLockAction } from "@/app/features/auth/hooks/use-app-lock-action";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { createPendingStartupAuthState } from "@/app/features/auth/services/startup-auth-state-contracts";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useProfilePublisher } from "@/app/features/profile/hooks/use-profile-publisher";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { decodePrivateKey } from "@/app/features/auth/utils/decode-private-key";
import { NATIVE_KEY_SENTINEL } from "@/app/features/crypto/crypto-service";
import { encryptedAccountBackupService } from "@/app/features/account-sync/services/encrypted-account-backup-service";
import { accountProjectionRuntime } from "@/app/features/account-sync/services/account-projection-runtime";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { revealExportPathInFileManager } from "@/app/features/profiles/services/data-root-export-service";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import type { SettingsTabPanelModel } from "../settings-tab-panel-model-context";
import { PRIVATE_KEY_REVEAL_WINDOW_MS } from "../settings-tab-panel-shared";
import type { IdentityIntegrityState, IdentityStorageMode } from "../settings-tab-panel-shared";
import { usePrivacySettingsCore } from "./use-privacy-settings-model";
import { useSettingsDestructiveActionsModel } from "./use-settings-destructive-actions-model";

export function useIdentitySettingsModel(): SettingsTabPanelModel {
  const { t } = useTranslation();
  const identity = useIdentity();
  const { lockApp } = useAppLockAction();
  const profile = useProfile();
  const { isPublishing } = useProfilePublisher();
  const privacy = usePrivacySettingsCore();
  const destructive = useSettingsDestructiveActionsModel();

  const displayPublicKeyHex: string = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? "";
  const publicKeyHex: PublicKeyHex | null = (displayPublicKeyHex as PublicKeyHex | null) ?? null;

  const [isPrivateKeyVisible, setIsPrivateKeyVisible] = useState<boolean>(false);
  const [nsecKey, setNsecKey] = useState<string | null>(null);
  const [challangePassword, setChallengePassword] = useState("");
  const [isChallenging, setIsChallenging] = useState(false);
  const [revealExpiresAtMs, setRevealExpiresAtMs] = useState<number | null>(null);
  const [revealSecondsLeft, setRevealSecondsLeft] = useState<number>(0);
  const [isPortableBundleExporting, setIsPortableBundleExporting] = useState(false);
  const [isPortableBundleImporting, setIsPortableBundleImporting] = useState(false);
  const portableBundleFileInputRef = useRef<HTMLInputElement | null>(null);

  const npubValue = useMemo(() => {
    try {
      return displayPublicKeyHex ? nip19.npubEncode(displayPublicKeyHex) : "";
    } catch {
      return "";
    }
  }, [displayPublicKeyHex]);

  const identityDiagnostics = identity.getIdentityDiagnostics?.();
  const startupState = identityDiagnostics?.startupState ?? createPendingStartupAuthState({
    storedPublicKeyHex: identity.state.stored?.publicKeyHex,
  });

  const identityStorageMode = useMemo<IdentityStorageMode>(() => {
    if (identity.state.privateKeyHex === NATIVE_KEY_SENTINEL) return "native";
    if (identity.state.privateKeyHex) return "session_only";
    if (identity.state.stored?.encryptedPrivateKey) return "encrypted_local";
    return "unknown";
  }, [identity.state.privateKeyHex, identity.state.stored?.encryptedPrivateKey]);

  const derivedPublicKeyHex = useMemo(() => {
    if (!identity.state.privateKeyHex || identity.state.privateKeyHex === NATIVE_KEY_SENTINEL) {
      return undefined;
    }
    try {
      return derivePublicKeyHex(identity.state.privateKeyHex);
    } catch {
      return undefined;
    }
  }, [identity.state.privateKeyHex]);

  const identityIntegrityState = useMemo<IdentityIntegrityState>(() => {
    if (!identity.state.stored?.publicKeyHex) return "unknown";
    if (startupState.kind === "mismatch") return "mismatch";
    if (derivedPublicKeyHex && derivedPublicKeyHex !== identity.state.stored.publicKeyHex) return "mismatch";
    return "ok";
  }, [derivedPublicKeyHex, identity.state.stored?.publicKeyHex, startupState.kind]);

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

  const handleRevealToggle = async (): Promise<void> => {
    if (identityIntegrityState === "mismatch") {
      toast.error(identityDiagnostics?.message || "Identity mismatch detected. Resolve diagnostics before key reveal.");
      return;
    }
    if (!isPrivateKeyVisible) {
      if (identity.state.privateKeyHex === NATIVE_KEY_SENTINEL) {
        try {
          let biometricVerified = false;
          try {
            const biometricResult = await invokeNativeCommand<boolean>("request_biometric_auth");
            if (biometricResult.ok && biometricResult.value) {
              biometricVerified = true;
            } else if (privacy.privacySettings.biometricLockEnabled) {
              toast.error("Native authentication failed.");
              return;
            }
          } catch {
            if (privacy.privacySettings.biometricLockEnabled) {
              toast.error("Native authentication failed.");
              return;
            }
          }
          if (!biometricVerified && !privacy.privacySettings.biometricLockEnabled) {
            toast.warning("Biometric check unavailable. Using active native session.");
          }
          const nsecResult = await invokeNativeCommand<string>("get_session_nsec");
          if (!nsecResult.ok || !nsecResult.value) {
            toast.error("Security: Failed to fetch key from native storage.");
            return;
          }
          setNsecKey(nsecResult.value);
          setIsPrivateKeyVisible(true);
          setRevealExpiresAtMs(Date.now() + PRIVATE_KEY_REVEAL_WINDOW_MS);
        } catch (e) {
          console.error("Failed to fetch native key:", e);
          toast.error("Security: Failed to fetch key from native storage.");
          return;
        }
      } else {
        setIsChallenging(true);
      }
    } else {
      setIsPrivateKeyVisible(false);
      setNsecKey(null);
      setChallengePassword("");
      setRevealExpiresAtMs(null);
    }
  };

  const handleVerifyChallenge = async (): Promise<void> => {
    if (!challangePassword) return;
    try {
      await identity.unlockIdentity({ passphrase: challangePassword as never });
      const state = identity.getIdentitySnapshot();
      if (state.privateKeyHex) {
        const bytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
          bytes[i] = parseInt(state.privateKeyHex.slice(i * 2, i * 2 + 2), 16);
        }
        setNsecKey(nip19.nsecEncode(bytes));
        setIsPrivateKeyVisible(true);
        setIsChallenging(false);
        setChallengePassword("");
        setRevealExpiresAtMs(Date.now() + PRIVATE_KEY_REVEAL_WINDOW_MS);
        toast.success("Identity Unlocked");
      }
    } catch {
      toast.error("Incorrect password");
    }
  };

  const copyPrivateKey = async (): Promise<void> => {
    let keyToCopy = nsecKey;
    if (!keyToCopy && identity.state.privateKeyHex) {
      if (identity.state.privateKeyHex === NATIVE_KEY_SENTINEL) {
        try {
          const nsecResult = await invokeNativeCommand<string>("get_session_nsec");
          if (!nsecResult.ok || !nsecResult.value) {
            toast.error("Failed to fetch key.");
            return;
          }
          keyToCopy = nsecResult.value;
        } catch {
          toast.error("Failed to fetch key.");
          return;
        }
      } else {
        try {
          const bytes = new Uint8Array(32);
          for (let i = 0; i < 32; i++) {
            bytes[i] = parseInt(identity.state.privateKeyHex.slice(i * 2, i * 2 + 2), 16);
          }
          keyToCopy = nip19.nsecEncode(bytes);
        } catch {
          // ignore
        }
      }
    }
    if (keyToCopy) {
      await navigator.clipboard.writeText(keyToCopy);
      toast.success(t("common.copied"));
    }
  };

  const exportPrivateKey = async (): Promise<void> => {
    let key = nsecKey;
    if (!key && identity.state.privateKeyHex && identity.state.privateKeyHex !== NATIVE_KEY_SENTINEL) {
      const bytes = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(identity.state.privateKeyHex.slice(i * 2, i * 2 + 2), 16);
      }
      key = nip19.nsecEncode(bytes);
    }
    if (!key) {
      toast.error("Private key is not currently available to export.");
      return;
    }
    const payload = `# Obscur Private Key Backup\n${key}\n`;
    const blob = new Blob([payload], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "obscur-private-key-backup.txt";
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Private key exported.");
  };

  const handleExportPortableBundle = async (): Promise<void> => {
    if (!publicKeyHex) {
      toast.error("No active account found.");
      return;
    }
    if (isPortableBundleExporting) {
      return;
    }
    setIsPortableBundleExporting(true);
    try {
      const privateKeyHex = await resolveActivePrivateKeyHex();
      if (!privateKeyHex) {
        throw new Error("Unlock this account first so private state can be exported.");
      }
      const { bundle } = await encryptedAccountBackupService.exportPortableAccountBundle({
        publicKeyHex,
        privateKeyHex,
        profileLabel: profile.state.profile.username,
      });
      const exportedAtIso = new Date(bundle.exportedAtUnixMs).toISOString().replace(/[:.]/g, "-");
      const filename = `obscur-portable-account-${publicKeyHex.slice(0, 8)}-${exportedAtIso}.json`;
      const { writePortableAccountExportToDataRoot } = await import("@/app/features/profiles/services/unified-account-export-service");
      const writeResult = await writePortableAccountExportToDataRoot({ fileName: filename, bundle });
      toast.success("Portable account bundle exported.");
      if (writeResult.absolutePath) {
        await revealExportPathInFileManager(writeResult.absolutePath);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Portable bundle export failed.");
    } finally {
      setIsPortableBundleExporting(false);
    }
  };

  const handlePortableBundleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!publicKeyHex) {
      toast.error("No active account found.");
      event.currentTarget.value = "";
      return;
    }
    if (isPortableBundleImporting) {
      event.currentTarget.value = "";
      return;
    }
    setIsPortableBundleImporting(true);
    try {
      const privateKeyHex = await resolveActivePrivateKeyHex();
      if (!privateKeyHex) {
        throw new Error("Unlock this account first so portable data can be imported.");
      }
      const fileText = await file.text();
      const rawBundle = JSON.parse(fileText);
      await encryptedAccountBackupService.importPortableAccountBundle({
        bundle: rawBundle,
        publicKeyHex,
        privateKeyHex,
        profileId: getResolvedProfileId(),
        appendCanonicalEvents: accountProjectionRuntime.appendCanonicalEvents.bind(accountProjectionRuntime),
      });
      toast.success("Portable account bundle imported.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Portable bundle import failed.");
    } finally {
      event.currentTarget.value = "";
      setIsPortableBundleImporting(false);
    }
  };

  const handleProfileSwitchLock = (): void => {
    setIsPrivateKeyVisible(false);
    setNsecKey(null);
    setRevealExpiresAtMs(null);
    setIsChallenging(false);
    void lockApp();
  };

  useEffect(() => {
    if (!isPrivateKeyVisible || !revealExpiresAtMs) {
      setRevealSecondsLeft(0);
      return;
    }
    const tick = (): void => {
      const leftMs = revealExpiresAtMs - Date.now();
      const next = Math.max(0, Math.ceil(leftMs / 1000));
      setRevealSecondsLeft(next);
      if (leftMs <= 0) {
        setIsPrivateKeyVisible(false);
        setNsecKey(null);
        setRevealExpiresAtMs(null);
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [isPrivateKeyVisible, revealExpiresAtMs]);

  useEffect(() => {
    const onBlur = (): void => {
      if (!isPrivateKeyVisible) return;
      setIsPrivateKeyVisible(false);
      setNsecKey(null);
      setRevealExpiresAtMs(null);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("blur", onBlur);
      return () => window.removeEventListener("blur", onBlur);
    }
  }, [isPrivateKeyVisible]);

  return {
    ...destructive,
    challangePassword,
    copyPrivateKey,
    derivedPublicKeyHex,
    displayPublicKeyHex,
    exportPrivateKey,
    handleExportPortableBundle,
    handlePortableBundleFileSelected,
    handleProfileSwitchLock,
    handleRevealToggle,
    handleVerifyChallenge,
    identity,
    identityDiagnostics,
    identityIntegrityState,
    identityStorageMode,
    isChallenging,
    isPortableBundleExporting,
    isPortableBundleImporting,
    isPrivateKeyVisible,
    isPublishing,
    npubValue,
    nsecKey,
    portableBundleFileInputRef,
    privacySettings: privacy.privacySettings,
    profile,
    publicKeyHex,
    resolveActivePrivateKeyHex,
    revealExpiresAtMs,
    revealSecondsLeft,
    setChallengePassword,
    setIsChallenging,
    setIsDeleteAccountDialogOpen: destructive.setIsDeleteAccountDialogOpen,
    setIsPortableBundleExporting,
    setIsPortableBundleImporting,
    setIsPrivateKeyVisible,
    setNsecKey,
    setRevealExpiresAtMs,
    setRevealSecondsLeft,
    startupState,
    t,
  };
}
