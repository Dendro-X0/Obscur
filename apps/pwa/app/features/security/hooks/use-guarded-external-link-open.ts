"use client";

import { useCallback, useState } from "react";
import { requiresLinkConfirmBeforeOpen } from "@/app/features/dm-kernel/dm-kernel-trust-link-action-gate";
import { openNativeExternal } from "@/app/features/runtime/native-host-adapter";

export type GuardedExternalLinkOpen = Readonly<{
  pendingLinkUrl: string | null;
  cancelPendingLink: () => void;
  confirmPendingLink: () => void;
  openExternalLink: (url: string) => void;
  requestOpenExternalLink: (url: string) => void;
  requestOpenExternalLinkPreferNative: (url: string) => Promise<void>;
  handleAnchorClick: (event: React.MouseEvent<HTMLAnchorElement>, url: string) => void;
}>;

export const useGuardedExternalLinkOpen = (): GuardedExternalLinkOpen => {
  const [pendingLinkUrl, setPendingLinkUrl] = useState<string | null>(null);

  const openExternalLink = useCallback((url: string): void => {
    if (typeof window === "undefined") {
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const requestOpenExternalLink = useCallback((url: string): void => {
    if (!requiresLinkConfirmBeforeOpen(url)) {
      openExternalLink(url);
      return;
    }
    setPendingLinkUrl(url);
  }, [openExternalLink]);

  const requestOpenExternalLinkPreferNative = useCallback(async (url: string): Promise<void> => {
    try {
      const openedNatively = await openNativeExternal(url);
      if (openedNatively) {
        return;
      }
    } catch {
      // Fall back to guarded browser open below.
    }
    requestOpenExternalLink(url);
  }, [requestOpenExternalLink]);

  const handleAnchorClick = useCallback((
    event: React.MouseEvent<HTMLAnchorElement>,
    url: string,
  ): void => {
    if (!requiresLinkConfirmBeforeOpen(url)) {
      return;
    }
    event.preventDefault();
    setPendingLinkUrl(url);
  }, []);

  const cancelPendingLink = useCallback((): void => {
    setPendingLinkUrl(null);
  }, []);

  const confirmPendingLink = useCallback((): void => {
    if (!pendingLinkUrl) {
      return;
    }
    const url = pendingLinkUrl;
    setPendingLinkUrl(null);
    openExternalLink(url);
  }, [openExternalLink, pendingLinkUrl]);

  return {
    pendingLinkUrl,
    cancelPendingLink,
    confirmPendingLink,
    openExternalLink,
    requestOpenExternalLink,
    requestOpenExternalLinkPreferNative,
    handleAnchorClick,
  };
};
