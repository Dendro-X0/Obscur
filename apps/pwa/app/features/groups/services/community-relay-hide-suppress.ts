import { SEALED_COMMUNITY_KIND_DELETE } from "./sealed-community-relay-kinds";

export type CommunityHideWireEvent = Readonly<{
  id: string;
  kind: number;
  tags: ReadonlyArray<ReadonlyArray<string>>;
}>;

/** In-memory index of event ids hidden via kind 5 (operator-relay D1). */
export class CommunityRelayHideRegistry {
  private readonly hiddenEventIds = new Set<string>();

  recordHideEvent(event: CommunityHideWireEvent): ReadonlyArray<string> {
    if (event.kind !== SEALED_COMMUNITY_KIND_DELETE) {
      return [];
    }
    const recorded: string[] = [];
    for (const tag of event.tags) {
      if (tag[0] === "e") {
        const targetId = tag[1]?.trim();
        if (targetId) {
          this.hiddenEventIds.add(targetId);
          recorded.push(targetId);
        }
      }
    }
    return recorded;
  }

  isHidden(eventId: string): boolean {
    return this.hiddenEventIds.has(eventId);
  }

  size(): number {
    return this.hiddenEventIds.size;
  }

  clear(): void {
    this.hiddenEventIds.clear();
  }
}

export const communityRelayHideRegistry = new CommunityRelayHideRegistry();

const isWireEvent = (value: unknown): value is CommunityHideWireEvent => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const event = value as CommunityHideWireEvent;
  return typeof event.id === "string" && typeof event.kind === "number" && Array.isArray(event.tags);
};

/**
 * Apply D1 suppress to a relay wire message.
 * Returns null when an EVENT for a hidden id should not be delivered to subscribers.
 */
export const filterCommunityRelayWireMessage = (
  message: string,
  registry: CommunityRelayHideRegistry = communityRelayHideRegistry,
): string | null => {
  try {
    const parsed: unknown = JSON.parse(message);
    if (!Array.isArray(parsed) || parsed.length < 2) {
      return message;
    }
    const verb = parsed[0];
    const payload = parsed[1];
    if (verb === "EVENT" && isWireEvent(payload)) {
      if (payload.kind === SEALED_COMMUNITY_KIND_DELETE) {
        registry.recordHideEvent(payload);
        return message;
      }
      if (registry.isHidden(payload.id)) {
        return null;
      }
    }
  } catch {
    // Non-JSON frames pass through unchanged.
  }
  return message;
};

/** Record hide targets when publishing kind 5 to an operator workspace relay. */
export const recordCommunityHidePublishPayload = (
  payload: string,
  registry: CommunityRelayHideRegistry = communityRelayHideRegistry,
): void => {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (!Array.isArray(parsed) || parsed[0] !== "EVENT" || !isWireEvent(parsed[1])) {
      return;
    }
    registry.recordHideEvent(parsed[1]);
  } catch {
    // ignore
  }
};
