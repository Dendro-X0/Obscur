/**
 * Hybrid DM relay targeting: union recipient-facing relays (discovery, NIP-65,
 * inbound evidence) with sender publish paths. Used by the legacy outgoing
 * orchestrator and the v2 DM relay transport so both paths converge on one
 * contract (see docs / product hybrid relay strategy).
 */

const dedupeRelayUrls = (relayUrls: ReadonlyArray<string>): ReadonlyArray<string> => (
  Array.from(new Set(relayUrls.map((url) => url.trim()).filter((url) => url.length > 0)))
);

const getConnectionLifecycleTag = (customTags?: ReadonlyArray<ReadonlyArray<string>>): string | null => {
  const lifecycleTag = customTags?.find((tag) => tag[0] === "t")?.[1];
  if (
    lifecycleTag === "connection-request"
    || lifecycleTag === "connection-accept"
    || lifecycleTag === "connection-decline"
    || lifecycleTag === "connection-cancel"
    || lifecycleTag === "connection-received"
    || lifecycleTag === "connection-receipt"
  ) {
    return lifecycleTag;
  }
  return null;
};

export type RecipientRelayScopeSource =
  | "recipient_discovery"
  | "recipient_write_relays"
  | "peer_inbound_evidence"
  | "sender_fallback";

export type DmHybridRelayTargetingResult = Readonly<{
  lifecycleTag: string | null;
  targetRelayUrls: ReadonlyArray<string>;
  recipientScopeRelayUrls: ReadonlyArray<string>;
  recipientScopeSources: ReadonlyArray<RecipientRelayScopeSource>;
  relayScopeSource: RecipientRelayScopeSource | "mixed_recipient_scope";
  usedRecipientScopeOnly: boolean;
}>;

export const resolveDmHybridRelayTargeting = (params: Readonly<{
  customTags?: ReadonlyArray<ReadonlyArray<string>>;
  discoveredRecipientRelayUrls: ReadonlyArray<string>;
  senderOpenRelayUrls: ReadonlyArray<string>;
  senderWriteRelayUrls: ReadonlyArray<string>;
  recipientWriteRelayUrls: ReadonlyArray<string>;
  recipientInboundRelayUrls: ReadonlyArray<string>;
}>): DmHybridRelayTargetingResult => {
  const lifecycleTag = getConnectionLifecycleTag(params.customTags);
  const recipientScopeSources: RecipientRelayScopeSource[] = [];
  if (params.discoveredRecipientRelayUrls.length > 0) {
    recipientScopeSources.push("recipient_discovery");
  }
  if (params.recipientWriteRelayUrls.length > 0) {
    recipientScopeSources.push("recipient_write_relays");
  }
  if (params.recipientInboundRelayUrls.length > 0) {
    recipientScopeSources.push("peer_inbound_evidence");
  }
  const recipientScopeRelayUrls = dedupeRelayUrls([
    ...params.discoveredRecipientRelayUrls,
    ...params.recipientWriteRelayUrls,
    ...params.recipientInboundRelayUrls,
  ]);
  const relayScopeSource = recipientScopeSources.length === 0
    ? "sender_fallback"
    : recipientScopeSources.length === 1
      ? recipientScopeSources[0]
      : "mixed_recipient_scope";

  // message-delete uses the same hybrid union as ordinary DMs. Narrowing delete
  // to recipient scope only caused remote misses when traffic was actually
  // delivered via sender writable / open relays or pool fallbacks.

  if (lifecycleTag) {
    if (recipientScopeRelayUrls.length > 0) {
      return {
        lifecycleTag,
        targetRelayUrls: dedupeRelayUrls([
          ...recipientScopeRelayUrls,
          ...params.senderOpenRelayUrls,
          ...params.senderWriteRelayUrls,
        ]),
        recipientScopeRelayUrls,
        recipientScopeSources,
        relayScopeSource,
        usedRecipientScopeOnly: false,
      };
    }

    return {
      lifecycleTag,
      targetRelayUrls: dedupeRelayUrls([
        ...params.senderOpenRelayUrls,
        ...params.senderWriteRelayUrls,
      ]),
      recipientScopeRelayUrls,
      recipientScopeSources,
      relayScopeSource,
      usedRecipientScopeOnly: false,
    };
  }

  return {
    lifecycleTag: null,
    targetRelayUrls: dedupeRelayUrls([
      ...recipientScopeRelayUrls,
      ...params.senderOpenRelayUrls,
      ...params.senderWriteRelayUrls,
    ]),
    recipientScopeRelayUrls,
    recipientScopeSources,
    relayScopeSource,
    usedRecipientScopeOnly: false,
  };
};
