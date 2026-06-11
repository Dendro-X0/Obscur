import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type WorkspaceKernelTransportPortStatus = "w2_landed";

export const workspaceKernelTransportPortStatus = (): WorkspaceKernelTransportPortStatus => "w2_landed";

/** Relay publish is injected into write-port via {@link WorkspaceKernelSealedEventPublisher}. */
export type WorkspaceKernelScopedRelayPublishTarget = Readonly<{
  relayUrl: string;
}>;

export const resolveWorkspaceKernelScopedRelayUrl = (
  relayUrl: string,
): string => relayUrl.trim();

export const isWorkspaceKernelTransportScopedToRelay = (
  relayUrl: string,
  allowedRelayUrl: PublicKeyHex | string,
): boolean => resolveWorkspaceKernelScopedRelayUrl(relayUrl).length > 0
  && resolveWorkspaceKernelScopedRelayUrl(String(allowedRelayUrl)).length > 0;
