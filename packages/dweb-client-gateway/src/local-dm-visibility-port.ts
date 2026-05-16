/**
 * Local DM visibility — canonical contract for delete-for-me and read filtering.
 * Network truth may still carry historical rows; this port defines local shell visibility.
 */

export type LocalDmVisibilityScope = Readonly<{
  profileId: string;
  accountPublicKeyHex?: string;
}>;

export type ExecuteLocalDmDeleteForMeParams = Readonly<{
  conversationId: string;
  messageIdentityIds: ReadonlyArray<string>;
  accountPublicKeyHex: string;
  profileId?: string;
  observedAtUnixMs?: number;
}>;

export type MessageLikeWithIdentity = Readonly<{
  id: string;
  eventId?: string | null;
  /** NIP-17 gift-wrap relay `event.id` when the display id / eventId are the inner rumor id. */
  relayPublishedEventId?: string | null;
}>;

export type PersistLocalDmSuppressionParams = Readonly<{
  conversationId: string;
  messageIdentityIds: ReadonlyArray<string>;
  profileId?: string;
  deletedAtUnixMs?: number;
}>;

export type LocalDmVisibilityPort = Readonly<{
  ensureReady: (scope: LocalDmVisibilityScope) => Promise<void>;
  getSuppressedIdentityIds: (profileId: string) => ReadonlySet<string>;
  filterVisibleMessages: <T extends MessageLikeWithIdentity>(
    messages: ReadonlyArray<T>,
    profileId: string,
  ) => ReadonlyArray<T>;
  persistSuppressionStores: (params: PersistLocalDmSuppressionParams) => Promise<ReadonlyArray<string>>;
  reconcileAccountEventLog: (params: Readonly<{
    profileId: string;
    accountPublicKeyHex: string;
    extraMessageIds?: ReadonlyArray<string>;
    replayProjection?: boolean | undefined;
  }>) => Promise<Readonly<{ redactedCount: number; removedEventsAppended: number }>>;
  executeDeleteForMe: (params: ExecuteLocalDmDeleteForMeParams) => Promise<ReadonlyArray<string>>;
}>;
