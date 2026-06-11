import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";

/**
 * Path B B1-3 — at most one live `useSealedCommunity` (+ matching relay ingest) per community scope.
 *
 * Workspace kernel W0: legacy sealed-community instances are disabled when
 * {@link isWorkspaceKernelAuthority} is true (subtraction before W1–W3 ports).
 *
 * - Main shell (`/` sidebar group chat): {@link resolveMainShellSealedCommunityEnabled}
 * - Group home (`/groups/[id]`): {@link resolveGroupHomeSealedCommunityEnabled}
 * - Group thread relay ingest: {@link resolveMainShellGroupThreadRelayIngestEnabled} /
 *   {@link resolveGroupHomeGroupThreadRelayIngestEnabled} (stays on under workspace kernel)
 * - Management dialog: fallback only when parent does not pass `communityController`
 *
 * Layout subtracts duplicate mounts: {@link isChatRoutePathname} gates MainShell;
 * group-home routes render the group-home client without MainShell.
 */

export const isChatRoutePathname = (pathname: string | null | undefined): boolean => (
  pathname === "/"
);

export const isGroupCommunityHomePathname = (pathname: string | null | undefined): boolean => (
  Boolean(
    pathname
    && /^\/groups\/[^/]+/.test(pathname)
    && !pathname.startsWith("/groups/leave")
    && !pathname.startsWith("/groups/purge"),
  )
);

export type ResolveMainShellSealedCommunityEnabledParams = Readonly<{
  selectedConversationKind: string | null | undefined;
  pathname: string | null | undefined;
  hasRelayTransport: boolean;
}>;

/** Sidebar group chat on `/` — disabled on group-home routes (defense-in-depth). */
export const resolveMainShellSealedCommunityEnabled = (
  params: ResolveMainShellSealedCommunityEnabledParams,
): boolean => (
  !isWorkspaceKernelAuthority()
  && params.selectedConversationKind === "group"
  && !isGroupCommunityHomePathname(params.pathname)
  && params.hasRelayTransport
);

/**
 * Relay ingest for group chat on `/` — stays enabled under workspace kernel (W2 thread path).
 * Legacy membership hook remains gated by {@link resolveMainShellSealedCommunityEnabled}.
 */
export const resolveMainShellGroupThreadRelayIngestEnabled = (
  params: ResolveMainShellSealedCommunityEnabledParams,
): boolean => (
  params.selectedConversationKind === "group"
  && !isGroupCommunityHomePathname(params.pathname)
  && params.hasRelayTransport
);

export type ResolveGroupHomeSealedCommunityEnabledParams = Readonly<{
  hasCommunityContext: boolean;
  hasRelayTransport: boolean;
}>;

/** Canonical sealed-community owner for `/groups/[id]` surfaces. */
export const resolveGroupHomeSealedCommunityEnabled = (
  params: ResolveGroupHomeSealedCommunityEnabledParams,
): boolean => (
  !isWorkspaceKernelAuthority()
  && params.hasCommunityContext
  && params.hasRelayTransport
);

/**
 * Relay ingest on group-home — stays enabled under workspace kernel (W2 thread path).
 */
export const resolveGroupHomeGroupThreadRelayIngestEnabled = (
  params: ResolveGroupHomeSealedCommunityEnabledParams,
): boolean => (
  params.hasCommunityContext
  && params.hasRelayTransport
);

export type ResolveGroupManagementSealedCommunityEnabledParams = Readonly<{
  isOpen: boolean;
  hasParentController: boolean;
}>;

/** Avoid a second hook when group-home (or another parent) already owns the instance. */
export const resolveGroupManagementSealedCommunityEnabled = (
  params: ResolveGroupManagementSealedCommunityEnabledParams,
): boolean => (
  !isWorkspaceKernelAuthority()
  && params.isOpen
  && !params.hasParentController
);

/** False only when a pathname would enable both main-shell and group-home owners (invalid overlap). */
export const areSealedCommunityRouteSurfacesExclusive = (
  pathname: string | null | undefined,
): boolean => (
  !(isChatRoutePathname(pathname) && isGroupCommunityHomePathname(pathname))
);
