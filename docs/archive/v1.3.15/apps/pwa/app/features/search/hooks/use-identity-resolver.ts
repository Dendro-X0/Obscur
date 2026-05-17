"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { resolveIdentity } from "@/app/features/search/services/identity-resolver";
import type { ResolveResult } from "@/app/features/search/types/discovery";
import { useTanstackQueryRuntime } from "@/app/features/query/providers/tanstack-query-runtime-provider";
import { queryKeyFactory } from "@/app/features/query/services/query-key-factory";
import { markTanstackQueryPath } from "@/app/features/query/services/tanstack-query-diagnostics";
import { createQueryScope } from "@/app/features/query/services/query-scope";
import { getActiveProfileIdSafe } from "@/app/features/profiles/services/profile-scope";

type ResolverPhase = "idle" | "resolving" | "resolved" | "failed";
type ResolveIdentityOptions = Readonly<{
  allowLegacyInviteCode?: boolean;
}>;

export const useIdentityResolver = () => {
  const { relayPool } = useRelay();
  const tanstackQueryRuntime = useTanstackQueryRuntime();
  const [phase, setPhase] = useState<ResolverPhase>("idle");
  const [result, setResult] = useState<ResolveResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastResolveQueryKeyRef = useRef<ReturnType<typeof queryKeyFactory.identityResolution> | null>(null);

  useEffect(() => {
    markTanstackQueryPath("identity_resolution", tanstackQueryRuntime?.enabled === true ? "tanstack" : "legacy");
  }, [tanstackQueryRuntime?.enabled]);

  const resolve = useCallback(async (query: string, options?: ResolveIdentityOptions): Promise<ResolveResult> => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (tanstackQueryRuntime?.enabled && lastResolveQueryKeyRef.current) {
      void tanstackQueryRuntime.queryClient.cancelQueries({
        queryKey: lastResolveQueryKeyRef.current,
        exact: true,
      });
      lastResolveQueryKeyRef.current = null;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("resolving");
    setResult(null);
    try {
      const allowLegacyInviteCode = options?.allowLegacyInviteCode !== false;
      const scope = tanstackQueryRuntime?.scope ?? createQueryScope({
        profileId: getActiveProfileIdSafe(),
        publicKeyHex: null,
      });
      const resolveQueryKey = queryKeyFactory.identityResolution({
        scope,
        query,
        allowLegacyInviteCode,
      });
      lastResolveQueryKeyRef.current = resolveQueryKey;
      const resolved = tanstackQueryRuntime?.enabled
        ? await tanstackQueryRuntime.queryClient.fetchQuery({
          queryKey: resolveQueryKey,
          queryFn: ({ signal }) => resolveIdentity({
            query,
            pool: relayPool,
            indexBaseUrl: process.env.NEXT_PUBLIC_DISCOVERY_INDEX_URL,
            signal,
            allowLegacyInviteCode,
          }),
        })
        : await resolveIdentity({
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
  }, [relayPool, tanstackQueryRuntime]);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (tanstackQueryRuntime?.enabled && lastResolveQueryKeyRef.current) {
      void tanstackQueryRuntime.queryClient.cancelQueries({
        queryKey: lastResolveQueryKeyRef.current,
        exact: true,
      });
      lastResolveQueryKeyRef.current = null;
    }
    setResult(null);
    setPhase("idle");
  }, [tanstackQueryRuntime]);

  return useMemo(() => ({
    phase,
    result,
    resolve,
    reset,
  }), [phase, result, resolve, reset]);
};
