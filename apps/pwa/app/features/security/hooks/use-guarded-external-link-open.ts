"use client";

import { useCallback, useState } from "react";
import { requiresLinkConfirmBeforeOpen } from "@/app/features/dm-kernel/dm-kernel-trust-link-action-gate";
import { openNativeExternal } from "@/app/features/runtime/native-host-adapter";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import {
  isLinkSafetyOutboundCheckEnabled,
  LINK_SAFETY_DEFAULT_PROVIDER_LABEL,
  resolveLinkSafetyAfterCancel,
} from "@/app/features/security/services/link-safety-policy";
import {
  fetchUrlReputation,
  type UrlReputationLookupResult,
} from "@/app/features/security/services/link-safety-reputation-client";

export type LinkOpenDialogPhase =
  | "local_confirm"
  | "reputation_consent"
  | "reputation_result";

export type GuardedExternalLinkOpen = Readonly<{
  pendingLinkUrl: string | null;
  pendingLinkPhase: LinkOpenDialogPhase | null;
  reputationResult: UrlReputationLookupResult | null;
  reputationChecking: boolean;
  reputationProviderLabel: string;
  cancelPendingLink: () => void;
  confirmPendingLink: () => Promise<void>;
  openExternalLink: (url: string) => void;
  requestOpenExternalLink: (url: string) => void;
  requestOpenExternalLinkPreferNative: (url: string) => Promise<void>;
  handleAnchorClick: (event: React.MouseEvent<HTMLAnchorElement>, url: string) => void;
}>;

const readOutboundEnabled = (): boolean =>
  isLinkSafetyOutboundCheckEnabled({
    outboundCheckEnabled: PrivacySettingsService.getSettings().linkSafetyOutboundCheckEnabled === true,
  });

export const useGuardedExternalLinkOpen = (): GuardedExternalLinkOpen => {
  const [pendingLinkUrl, setPendingLinkUrl] = useState<string | null>(null);
  const [pendingLinkPhase, setPendingLinkPhase] = useState<LinkOpenDialogPhase | null>(null);
  const [reputationResult, setReputationResult] = useState<UrlReputationLookupResult | null>(null);
  const [reputationChecking, setReputationChecking] = useState(false);

  const clearPending = useCallback((): void => {
    setPendingLinkUrl(null);
    setPendingLinkPhase(null);
    setReputationResult(null);
    setReputationChecking(false);
  }, []);

  const openExternalLink = useCallback((url: string): void => {
    if (typeof window === "undefined") {
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const beginOpenFlow = useCallback((url: string): void => {
    const outboundEnabled = readOutboundEnabled();
    const needsLocalConfirm = requiresLinkConfirmBeforeOpen(url);

    if (needsLocalConfirm) {
      setReputationResult(null);
      setPendingLinkUrl(url);
      setPendingLinkPhase("local_confirm");
      return;
    }
    if (outboundEnabled) {
      setReputationResult(null);
      setPendingLinkUrl(url);
      setPendingLinkPhase("reputation_consent");
      return;
    }
    openExternalLink(url);
  }, [openExternalLink]);

  const requestOpenExternalLink = useCallback((url: string): void => {
    beginOpenFlow(url);
  }, [beginOpenFlow]);

  const requestOpenExternalLinkPreferNative = useCallback(async (url: string): Promise<void> => {
    try {
      const openedNatively = await openNativeExternal(url);
      if (openedNatively) {
        return;
      }
    } catch {
      // Fall back to guarded browser open below.
    }
    beginOpenFlow(url);
  }, [beginOpenFlow]);

  const handleAnchorClick = useCallback((
    event: React.MouseEvent<HTMLAnchorElement>,
    url: string,
  ): void => {
    const outboundEnabled = readOutboundEnabled();
    if (!requiresLinkConfirmBeforeOpen(url) && !outboundEnabled) {
      return;
    }
    event.preventDefault();
    beginOpenFlow(url);
  }, [beginOpenFlow]);

  const cancelPendingLink = useCallback((): void => {
    if (pendingLinkPhase === "reputation_consent" || pendingLinkPhase === "reputation_result") {
      const afterCancel = resolveLinkSafetyAfterCancel("block_open");
      if (afterCancel.kind === "open_without_check" && pendingLinkUrl) {
        const url = pendingLinkUrl;
        clearPending();
        openExternalLink(url);
        return;
      }
    }
    clearPending();
  }, [clearPending, openExternalLink, pendingLinkPhase, pendingLinkUrl]);

  const confirmPendingLink = useCallback(async (): Promise<void> => {
    if (!pendingLinkUrl || !pendingLinkPhase) {
      return;
    }
    const url = pendingLinkUrl;

    if (pendingLinkPhase === "local_confirm") {
      if (readOutboundEnabled()) {
        setPendingLinkPhase("reputation_consent");
        setReputationResult(null);
        return;
      }
      clearPending();
      openExternalLink(url);
      return;
    }

    if (pendingLinkPhase === "reputation_consent") {
      setReputationChecking(true);
      try {
        const result = await fetchUrlReputation(url);
        setReputationResult(result);
        setPendingLinkPhase("reputation_result");
      } finally {
        setReputationChecking(false);
      }
      return;
    }

    if (pendingLinkPhase === "reputation_result") {
      clearPending();
      openExternalLink(url);
    }
  }, [clearPending, openExternalLink, pendingLinkPhase, pendingLinkUrl]);

  return {
    pendingLinkUrl,
    pendingLinkPhase,
    reputationResult,
    reputationChecking,
    reputationProviderLabel: LINK_SAFETY_DEFAULT_PROVIDER_LABEL,
    cancelPendingLink,
    confirmPendingLink,
    openExternalLink,
    requestOpenExternalLink,
    requestOpenExternalLinkPreferNative,
    handleAnchorClick,
  };
};
