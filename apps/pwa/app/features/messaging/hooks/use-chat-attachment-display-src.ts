"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeLocalMediaIndexChanged } from "@/app/features/vault/services/local-media-store";
import {
  fetchChatAttachmentDisplayFallback,
  isSessionOnlyMediaUrl,
  resolveChatAttachmentDisplayUrl,
} from "../services/chat-attachment-display-url";

/**
 * Resolves a durable message attachment URL into a session display src.
 * Re-resolves when local vault cache lands (sent-video race: CDN may briefly
 * serve a placeholder while the local bytes are still being written).
 * On webview load failure, caller should invoke `recoverFromLoadFailure`.
 */
export function useChatAttachmentDisplaySrc(remoteUrl: string): Readonly<{
  displaySrc: string;
  recoverFromLoadFailure: () => Promise<boolean>;
  isRecovering: boolean;
}> {
  const [displaySrc, setDisplaySrc] = useState(remoteUrl);
  const [isRecovering, setIsRecovering] = useState(false);
  const remoteRef = useRef(remoteUrl);
  const recoveredForRef = useRef<string | null>(null);
  const displaySrcRef = useRef(remoteUrl);

  useEffect(() => {
    displaySrcRef.current = displaySrc;
  }, [displaySrc]);

  const refreshDisplaySrc = useCallback(async (identity: string): Promise<void> => {
    const next = await resolveChatAttachmentDisplayUrl(identity);
    if (remoteRef.current !== identity) {
      return;
    }
    // Prefer a newly available local/session URL over a remote CDN placeholder.
    if (
      next !== displaySrcRef.current
      && (
        next !== identity
        || !isSessionOnlyMediaUrl(displaySrcRef.current)
      )
    ) {
      setDisplaySrc(next);
    }
  }, []);

  useEffect(() => {
    remoteRef.current = remoteUrl;
    recoveredForRef.current = null;
    setDisplaySrc(remoteUrl);
    let cancelled = false;

    const run = async (): Promise<void> => {
      const next = await resolveChatAttachmentDisplayUrl(remoteUrl);
      if (!cancelled && remoteRef.current === remoteUrl) {
        setDisplaySrc(next);
      }
    };

    void run();

    // Vault cache for sent media is async — refresh a few times until local wins.
    const retryTimers = [400, 1_200, 3_000].map((delayMs) => (
      window.setTimeout(() => {
        if (!cancelled && remoteRef.current === remoteUrl) {
          void refreshDisplaySrc(remoteUrl);
        }
      }, delayMs)
    ));

    const unsubscribe = subscribeLocalMediaIndexChanged(() => {
      if (!cancelled && remoteRef.current === remoteUrl) {
        void refreshDisplaySrc(remoteUrl);
      }
    });

    return () => {
      cancelled = true;
      retryTimers.forEach((timerId) => window.clearTimeout(timerId));
      unsubscribe();
    };
  }, [refreshDisplaySrc, remoteUrl]);

  const recoverFromLoadFailure = useCallback(async (): Promise<boolean> => {
    const identity = remoteRef.current.trim();
    if (!identity || recoveredForRef.current === identity) {
      return false;
    }
    setIsRecovering(true);
    try {
      const fallback = await fetchChatAttachmentDisplayFallback(identity);
      if (!fallback || remoteRef.current.trim() !== identity) {
        return false;
      }
      recoveredForRef.current = identity;
      setDisplaySrc(fallback);
      return true;
    } finally {
      setIsRecovering(false);
    }
  }, []);

  return { displaySrc, recoverFromLoadFailure, isRecovering };
}
