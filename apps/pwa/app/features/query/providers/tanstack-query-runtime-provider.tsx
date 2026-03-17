"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useWindowRuntimeSnapshot } from "@/app/features/runtime/services/window-runtime-supervisor";
import { createQueryScope, getQueryScopeCacheKey, type QueryScope } from "../services/query-scope";
import { updateTanstackQueryDiagnostics } from "../services/tanstack-query-diagnostics";
import { isTanstackQueryV1Enabled } from "../services/tanstack-query-rollout";

type TanstackQueryRuntime = Readonly<{
  queryClient: QueryClient;
  scope: QueryScope;
  enabled: boolean;
}>;

const TanstackQueryRuntimeContext = createContext<TanstackQueryRuntime | null>(null);

const isAbortError = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === "AbortError";
};

const createRuntimeQueryClient = (): QueryClient => (
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) => {
          if (isAbortError(error)) {
            return false;
          }
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
    },
  })
);

const useTanstackQueryEnabledFlag = (): boolean => {
  const [enabled, setEnabled] = useState<boolean>(() => isTanstackQueryV1Enabled());

  useEffect(() => {
    const handleSettingsChanged = (): void => {
      setEnabled(isTanstackQueryV1Enabled());
    };
    window.addEventListener("privacy-settings-changed", handleSettingsChanged);
    return (): void => {
      window.removeEventListener("privacy-settings-changed", handleSettingsChanged);
    };
  }, []);

  return enabled;
};

export const TanstackQueryRuntimeProvider = (props: Readonly<{ children: React.ReactNode }>): React.JSX.Element => {
  const runtimeSnapshot = useWindowRuntimeSnapshot();
  const identity = useIdentity();
  const rolloutEnabled = useTanstackQueryEnabledFlag();
  const queryClientRef = useRef<QueryClient | null>(null);
  const previousScopeKeyRef = useRef<string | null>(null);

  if (queryClientRef.current === null) {
    queryClientRef.current = createRuntimeQueryClient();
  }

  const scope = useMemo(() => {
    return createQueryScope({
      profileId: runtimeSnapshot.session.profileId,
      publicKeyHex: identity.state.publicKeyHex ?? null,
    });
  }, [identity.state.publicKeyHex, runtimeSnapshot.session.profileId]);

  const cacheScopeKey = useMemo(() => getQueryScopeCacheKey(scope), [scope]);

  useEffect(() => {
    const previousScopeKey = previousScopeKeyRef.current;
    if (previousScopeKey && previousScopeKey !== cacheScopeKey) {
      void queryClientRef.current?.cancelQueries();
      queryClientRef.current?.clear();
    }
    previousScopeKeyRef.current = cacheScopeKey;
  }, [cacheScopeKey]);

  useEffect(() => {
    updateTanstackQueryDiagnostics({
      enabled: rolloutEnabled,
      cacheScopeKey,
      profileId: scope.profileId,
      publicKeyHex: scope.publicKeyHex,
    });
  }, [cacheScopeKey, rolloutEnabled, scope.profileId, scope.publicKeyHex]);

  const runtime = useMemo<TanstackQueryRuntime>(() => ({
    queryClient: queryClientRef.current as QueryClient,
    scope,
    enabled: rolloutEnabled,
  }), [rolloutEnabled, scope]);

  return (
    <TanstackQueryRuntimeContext.Provider value={runtime}>
      <QueryClientProvider client={runtime.queryClient}>
        {props.children}
      </QueryClientProvider>
    </TanstackQueryRuntimeContext.Provider>
  );
};

export const useTanstackQueryRuntime = (): TanstackQueryRuntime | null => {
  return useContext(TanstackQueryRuntimeContext);
};

