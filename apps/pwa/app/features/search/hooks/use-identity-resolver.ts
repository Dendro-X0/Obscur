"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { resolveIdentity } from "@/app/features/search/services/identity-resolver";
import type { ResolveResult } from "@/app/features/search/types/discovery";

type ResolverPhase = "idle" | "resolving" | "resolved" | "failed";
type ResolveIdentityOptions = Readonly<{
  allowLegacyInviteCode?: boolean;
}>;

export const useIdentityResolver = () => {
  const { relayPool } = useRelay();
  const [phase, setPhase] = useState<ResolverPhase>("idle");
  const [result, setResult] = useState<ResolveResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resolve = useCallback(async (query: string, options?: ResolveIdentityOptions): Promise<ResolveResult> => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("resolving");
    setResult(null);
    try {
      const resolved = await resolveIdentity({
        query,
        pool: relayPool,
        indexBaseUrl: process.env.NEXT_PUBLIC_DISCOVERY_INDEX_URL,
        signal: controller.signal,
        allowLegacyInviteCode: options?.allowLegacyInviteCode,
      });
      setResult(resolved);
      setPhase(resolved.ok ? "resolved" : "failed");
      return resolved;
    } catch (error) {
      const failed: ResolveResult = {
        ok: false,
        reason: "canceled",
        message: error instanceof Error ? error.message : "Resolution canceled",
      };
      setResult(failed);
      setPhase("failed");
      return failed;
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [relayPool]);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setResult(null);
    setPhase("idle");
  }, []);

  return useMemo(() => ({
    phase,
    result,
    resolve,
    reset,
  }), [phase, result, resolve, reset]);
};
