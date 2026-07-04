import type { CommunityMode } from "../types";

export type GroupHomeCascadeGateParams = Readonly<{
  pageVisible: boolean;
  hasCommunityContext: boolean;
  workspaceKernelAuthority: boolean;
  communityMode: CommunityMode | null | undefined;
}>;

export type GroupHomeCascadeGate = Readonly<{
  /** Relay ingest and heavy page effects — no longer gated on health.ready (subtraction). */
  heavySideEffectsEnabled: boolean;
  directoryRecoveryEnabled: boolean;
}>;

export const isManagedWorkspaceCommunityMode = (
  mode: CommunityMode | null | undefined,
): boolean => mode === "managed_workspace";

/**
 * Page visibility gate only. Membership health is diagnostic — not a cascade breaker.
 */
export const resolveGroupHomeCascadeGate = (
  params: GroupHomeCascadeGateParams,
): GroupHomeCascadeGate => {
  const hasContext = params.pageVisible && params.hasCommunityContext;
  return {
    heavySideEffectsEnabled: hasContext,
    directoryRecoveryEnabled: hasContext,
  };
};
