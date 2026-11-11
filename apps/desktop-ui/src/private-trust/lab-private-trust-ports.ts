import {
  guardPrivateTrustSendFace,
  resolveActiveProtocolIdFromEvidence,
  type PrivateTrustProtocolId,
} from "@obscur/private-trust-engine";
import type {
  PrivateTrustConversationRow,
  PrivateTrustHomePorts,
  PrivateTrustMessageRow,
} from "./ports";

/**
 * In-memory lab adapter for Cut 3.3 L1 — not chat-state, not LS queue, not PDK.
 * Production wire = PAL/kernel DeviceUnlock + T3 send (optional L2).
 */
export const createLabPrivateTrustHomePorts = (params?: Readonly<{
  preferPrivateDc?: boolean;
  initialConversations?: ReadonlyArray<PrivateTrustConversationRow>;
}>): PrivateTrustHomePorts => {
  let storedProtocolId: PrivateTrustProtocolId | null = null;
  const preferPrivateDc = params?.preferPrivateDc !== false;

  const conversations = new Map<string, PrivateTrustConversationRow>();
  const messages = new Map<string, PrivateTrustMessageRow[]>();

  const seed = params?.initialConversations ?? [
    {
      id: "lab-peer-1",
      peerLabel: "Lab peer",
      preview: "H-dc lab thread",
      updatedAtUnixMs: Date.now(),
    },
  ];
  for (const row of seed) {
    conversations.set(row.id, row);
    messages.set(row.id, []);
  }

  return {
    resolveProtocolId: () => resolveActiveProtocolIdFromEvidence({
      storedProtocolId,
      preferPrivateDcWhenNoStored: preferPrivateDc,
    }),
    setProtocolId: (protocolId) => {
      storedProtocolId = protocolId;
    },
    listConversations: async () => (
      Array.from(conversations.values()).sort((a, b) => b.updatedAtUnixMs - a.updatedAtUnixMs)
    ),
    listMessages: async (conversationId) => (
      [...(messages.get(conversationId) ?? [])]
    ),
    sendDm: async ({ conversationId, body, carrier }) => {
      const active = resolveActiveProtocolIdFromEvidence({
        storedProtocolId,
        preferPrivateDcWhenNoStored: preferPrivateDc,
      });
      const guarded = guardPrivateTrustSendFace({
        activeProtocolId: active,
        requestedCarrier: carrier,
        body,
      });
      if (guarded) {
        return guarded;
      }
      if (carrier !== active) {
        return {
          ok: false,
          reasonCode: "send_failed",
          error: `Carrier ${carrier} does not match active face ${active}`,
        };
      }
      const conversation = conversations.get(conversationId);
      if (!conversation) {
        return { ok: false, reasonCode: "send_failed", error: "Unknown conversation" };
      }
      const messageId = `lab-msg-${Date.now()}`;
      const row: PrivateTrustMessageRow = {
        id: messageId,
        conversationId,
        body: body.trim(),
        direction: "out",
        sentAtUnixMs: Date.now(),
        deliveryStatus: "accepted",
      };
      const thread = messages.get(conversationId) ?? [];
      thread.push(row);
      messages.set(conversationId, thread);
      conversations.set(conversationId, {
        ...conversation,
        preview: row.body,
        updatedAtUnixMs: row.sentAtUnixMs,
      });
      return {
        ok: true,
        messageId,
        deliveryStatus: "accepted",
      };
    },
  };
};
