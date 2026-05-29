/** D1 — keep in sync with apps/pwa/.../community-relay-hide-suppress.ts */
const SEALED_COMMUNITY_KIND_DELETE = 5;

export type CommunityHideWireEvent = Readonly<{
  id: string;
  kind: number;
  tags: ReadonlyArray<ReadonlyArray<string>>;
}>;

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

  listHiddenEventIds(): ReadonlyArray<string> {
    return Array.from(this.hiddenEventIds);
  }

  mergeHiddenEventIds(ids: ReadonlyArray<string>): void {
    for (const id of ids) {
      const trimmed = id.trim();
      if (trimmed) {
        this.hiddenEventIds.add(trimmed);
      }
    }
  }

  clear(): void {
    this.hiddenEventIds.clear();
  }
}

const isWireEvent = (value: unknown): value is CommunityHideWireEvent => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const event = value as CommunityHideWireEvent;
  return typeof event.id === "string" && typeof event.kind === "number" && Array.isArray(event.tags);
};

export const filterCommunityRelayWireMessage = (
  message: string,
  registry: CommunityRelayHideRegistry,
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
    // pass through
  }
  return message;
};

export const recordCommunityHidePublishPayload = (
  payload: string,
  registry: CommunityRelayHideRegistry,
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
