"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchChatAttachmentDisplayFallback,
  resolveChatAttachmentDisplayUrl,
} from "../services/chat-attachment-display-url";

/**
 * Resolves a durable message attachment URL into a session display src.
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

  useEffect(() => {
    remoteRef.current = remoteUrl;
    recoveredForRef.current = null;
    setDisplaySrc(remoteUrl);
    let cancelled = false;
    void (async () => {
      const next = await resolveChatAttachmentDisplayUrl(remoteUrl);
      if (!cancelled && remoteRef.current === remoteUrl) {
        setDisplaySrc(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [remoteUrl]);

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
