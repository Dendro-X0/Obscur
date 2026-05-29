#!/usr/bin/env node
/**
 * D1 smoke: publish hide (kind 5) then verify target EVENT is suppressed on the same registry path.
 * Used in CI without a live WebSocket (pure logic). Gateway + PWA share the same contract.
 */
// Inline D1 contract mirror for CI (keep aligned with community-relay-hide-suppress.ts):
const SEALED_COMMUNITY_KIND_DELETE = 5;

class CommunityRelayHideRegistry {
  constructor() {
    this.hiddenEventIds = new Set();
  }
  recordHideEvent(event) {
    if (event.kind !== SEALED_COMMUNITY_KIND_DELETE) return [];
    const recorded = [];
    for (const tag of event.tags) {
      if (tag[0] === "e" && tag[1]) {
        this.hiddenEventIds.add(tag[1]);
        recorded.push(tag[1]);
      }
    }
    return recorded;
  }
  isHidden(id) {
    return this.hiddenEventIds.has(id);
  }
}

function filterCommunityRelayWireMessage(message, registry) {
  try {
    const parsed = JSON.parse(message);
    if (!Array.isArray(parsed) || parsed[0] !== "EVENT" || !parsed[1]?.id) {
      return message;
    }
    const payload = parsed[1];
    if (payload.kind === SEALED_COMMUNITY_KIND_DELETE) {
      registry.recordHideEvent(payload);
      return message;
    }
    if (registry.isHidden(payload.id)) {
      return null;
    }
  } catch {
    // pass
  }
  return message;
}

const main = () => {
  const registry = new CommunityRelayHideRegistry();
  const targetId = "a".repeat(64);
  const hideWire = JSON.stringify(["EVENT", {
    id: "b".repeat(64),
    kind: SEALED_COMMUNITY_KIND_DELETE,
    tags: [["e", targetId], ["h", "test-group"]],
  }]);
  filterCommunityRelayWireMessage(hideWire, registry);
  const msgWire = JSON.stringify(["EVENT", { id: targetId, kind: 10102, tags: [] }, "sub"]);
  const filtered = filterCommunityRelayWireMessage(msgWire, registry);
  if (filtered !== null) {
    console.error("[community-relay-hide-suppress-smoke] expected suppressed EVENT, got frame");
    process.exit(1);
  }
  console.log("[community-relay-hide-suppress-smoke] D1 suppress contract OK");
};

main();
