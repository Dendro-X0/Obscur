import { describe, expect, it } from "vitest";
import type { Message } from "@/app/features/messaging/types";
import { useChatActionsInternals } from "./use-chat-actions";

const buildMessage = (params: Readonly<{
  id: string;
  eventId?: string;
  content?: string;
  eventCreatedAtMs?: number;
  timestampMs?: number;
  attachments?: Message["attachments"];
  replyToMessageId?: string;
  isOutgoing?: boolean;
}>): Message => ({
  id: params.id,
  kind: "user",
  content: params.content ?? "",
  timestamp: new Date(params.timestampMs ?? 1_700_000_000_000),
  isOutgoing: params.isOutgoing ?? true,
  status: "delivered",
  eventId: params.eventId,
  eventCreatedAt: typeof params.eventCreatedAtMs === "number" ? new Date(params.eventCreatedAtMs) : undefined,
  attachments: params.attachments,
  replyTo: params.replyToMessageId
    ? { messageId: params.replyToMessageId, previewText: "" }
    : undefined,
});

describe("use-chat-actions delete target derivation", () => {
  it("only allows delete for everyone on self-authored messages", () => {
    const outgoingMessage = buildMessage({ id: "outgoing-1" });
    const incomingMessage = buildMessage({ id: "incoming-1", isOutgoing: false });

    expect(useChatActionsInternals.canDeleteMessageForEveryone(outgoingMessage)).toBe(true);
    expect(useChatActionsInternals.canDeleteMessageForEveryone(incomingMessage)).toBe(false);
    expect(useChatActionsInternals.getDeleteForEveryoneRejectionReason(outgoingMessage)).toBeNull();
    expect(useChatActionsInternals.getDeleteForEveryoneRejectionReason(incomingMessage)).toBe("not_outgoing_message");
  });

  it("derives rumor ids for attachment-only voice-note rows even when dmFormat is missing", async () => {
    const message = buildMessage({
      id: "giftwrap-id-1",
      eventId: "giftwrap-id-1",
      content: "",
      eventCreatedAtMs: 1_700_100_000_000,
      attachments: [{
        kind: "voice_note",
        url: "https://media.example/voice-note-1.webm",
        contentType: "audio/webm",
        fileName: "voice-note-1.webm",
      }],
    });

    const result = await useChatActionsInternals.buildDeleteTargetIdsForDm({
      message,
      senderPubkey: "a".repeat(64),
      recipientPubkey: "b".repeat(64),
    });

    const expectedRumorId = await useChatActionsInternals.deriveNip17RumorId({
      senderPubkey: "a".repeat(64),
      recipientPubkey: "b".repeat(64),
      plaintext: "[voice-note-1.webm](https://media.example/voice-note-1.webm)",
      createdAtUnixSeconds: Math.floor(1_700_100_000_000 / 1000),
      replyToMessageId: null,
    });

    expect(result).toContain("giftwrap-id-1");
    expect(result).toContain(expectedRumorId);
  });

  it("includes both eventCreatedAt and timestamp-derived rumor ids to tolerate hydrated timestamp drift", async () => {
    const message = buildMessage({
      id: "giftwrap-id-2",
      content: "voice note text",
      eventCreatedAtMs: 1_700_200_000_000,
      timestampMs: 1_700_200_123_000,
    });

    const result = await useChatActionsInternals.buildDeleteTargetIdsForDm({
      message,
      senderPubkey: "c".repeat(64),
      recipientPubkey: "d".repeat(64),
    });

    const expectedFromEventCreatedAt = await useChatActionsInternals.deriveNip17RumorId({
      senderPubkey: "c".repeat(64),
      recipientPubkey: "d".repeat(64),
      plaintext: "voice note text",
      createdAtUnixSeconds: Math.floor(1_700_200_000_000 / 1000),
      replyToMessageId: null,
    });
    const expectedFromTimestamp = await useChatActionsInternals.deriveNip17RumorId({
      senderPubkey: "c".repeat(64),
      recipientPubkey: "d".repeat(64),
      plaintext: "voice note text",
      createdAtUnixSeconds: Math.floor(1_700_200_123_000 / 1000),
      replyToMessageId: null,
    });

    expect(result).toContain(expectedFromEventCreatedAt);
    expect(result).toContain(expectedFromTimestamp);
  });

  it("falls back to direct ids when sender or recipient pubkey is unavailable", async () => {
    const message = buildMessage({
      id: "msg-1",
      eventId: "evt-1",
      content: "hello",
    });

    const result = await useChatActionsInternals.buildDeleteTargetIdsForDm({
      message,
      senderPubkey: null,
      recipientPubkey: "f".repeat(64),
    });

    expect(result).toEqual(expect.arrayContaining(["msg-1", "evt-1"]));
    expect(result).toHaveLength(2);
  });

  it("prioritizes canonical event id as the primary delete target when available", async () => {
    const message = buildMessage({
      id: "gift-wrap-event-id-1",
      eventId: "canonical-rumor-id-1",
      content: "hello",
    });

    const result = await useChatActionsInternals.buildDeleteTargetIdsForDm({
      message,
      senderPubkey: null,
      recipientPubkey: null,
    });

    expect(result[0]).toBe("canonical-rumor-id-1");
    expect(result).toEqual(expect.arrayContaining(["gift-wrap-event-id-1", "canonical-rumor-id-1"]));
  });
});
