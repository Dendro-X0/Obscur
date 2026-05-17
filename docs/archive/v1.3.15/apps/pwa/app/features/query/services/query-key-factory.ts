"use client";

import type { DiscoveryIntent } from "@/app/features/search/types/discovery";
import type { QueryScope } from "./query-scope";

const PHASE1_QUERY_NAMESPACE = "tanstack_query_v1";

type QueryFeatureNamespace =
  | "discovery_search"
  | "identity_resolution"
  | "relay_diagnostics_probe_snapshot"
  | "account_sync_snapshot";

type ScopedQueryKey = readonly [
  typeof PHASE1_QUERY_NAMESPACE,
  QueryFeatureNamespace,
  QueryScope,
  Readonly<Record<string, unknown>>?
];

const scopedKey = (
  feature: QueryFeatureNamespace,
  scope: QueryScope,
  params?: Readonly<Record<string, unknown>>
): ScopedQueryKey => {
  if (!params) {
    return [PHASE1_QUERY_NAMESPACE, feature, scope];
  }
  return [PHASE1_QUERY_NAMESPACE, feature, scope, params];
};

export const queryKeyFactory = {
  discoverySearch: (params: Readonly<{
    scope: QueryScope;
    query: string;
    intent: DiscoveryIntent;
  }>): ScopedQueryKey => (
    scopedKey("discovery_search", params.scope, {
      query: params.query,
      intent: params.intent,
    })
  ),
  identityResolution: (params: Readonly<{
    scope: QueryScope;
    query: string;
    allowLegacyInviteCode: boolean;
  }>): ScopedQueryKey => (
    scopedKey("identity_resolution", params.scope, {
      query: params.query,
      allowLegacyInviteCode: params.allowLegacyInviteCode,
    })
  ),
  relayDiagnosticsProbeSnapshot: (params: Readonly<{
    scope: QueryScope;
  }>): ScopedQueryKey => scopedKey("relay_diagnostics_probe_snapshot", params.scope),
  accountSyncSnapshot: (params: Readonly<{
    scope: QueryScope;
  }>): ScopedQueryKey => scopedKey("account_sync_snapshot", params.scope),
};

