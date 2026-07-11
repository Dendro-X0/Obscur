import { describe, expect, it } from "vitest";

import {
  COMMUNITY_INVITE_RESPONSE_ACCEPTED_PREVIEW,
  formatConversationMessagePreview,
} from "./format-conversation-message-preview";

describe("formatConversationMessagePreview", () => {
  it("formats incoming community invite JSON with peer name and wire role authority", () => {
    const viewerPk = "bb".repeat(32);
    const peerPk = "aa".repeat(32);
    const preview = formatConversationMessagePreview(JSON.stringify({
      type: "community-invite",
      groupId: "g1",
      roomKey: "rk",
      creatorPubkey: peerPk,
      metadata: { id: "g1", name: "Test 8" },
    }), {
      peerDisplayName: "Tester2",
      viewerPublicKeyHex: viewerPk,
      peerPublicKeyHex: peerPk,
      lastMessageIsOutgoing: true,
    });
    expect(preview).toBe("Tester2 invited you to Test 8");
  });

  it("formats incoming community invite JSON with peer name", () => {
    const preview = formatConversationMessagePreview(JSON.stringify({
      type: "community-invite",
      groupId: "g1",
      roomKey: "rk",
      metadata: { id: "g1", name: "Test 8" },
    }), { peerDisplayName: "Tester2", isOutgoing: false });
    expect(preview).toBe("Tester2 invited you to Test 8");
  });

  it("formats outgoing community invite JSON", () => {
    const preview = formatConversationMessagePreview(JSON.stringify({
      type: "community-invite",
      groupId: "g1",
      metadata: { id: "g1", name: "Test 8" },
    }), { isOutgoing: true });
    expect(preview).toBe("You sent an invitation to Test 8");
  });

  it("formats accepted invite response from peer", () => {
    const preview = formatConversationMessagePreview(JSON.stringify({
      type: "community-invite-response",
      inviteId: "legacy:abc",
      status: "accepted",
      groupId: "",
    }), { peerDisplayName: "Tester2", isOutgoing: false });
    expect(preview).toBe("Tester2 accepted the invitation");
  });

  it("formats declined invite response from self", () => {
    const preview = formatConversationMessagePreview(JSON.stringify({
      type: "community-invite-response",
      inviteId: "legacy:abc",
      status: "declined",
      groupId: "",
    }), { isOutgoing: true });
    expect(preview).toBe("You declined the invitation");
  });

  it("remaps legacy accepted preview copy with direction", () => {
    expect(formatConversationMessagePreview(
      COMMUNITY_INVITE_RESPONSE_ACCEPTED_PREVIEW,
      { peerDisplayName: "Tester2", isOutgoing: false },
    )).toBe("Tester2 accepted the invitation");
    expect(formatConversationMessagePreview(
      COMMUNITY_INVITE_RESPONSE_ACCEPTED_PREVIEW,
      { isOutgoing: true },
    )).toBe("You accepted the invitation");
  });

  it("remaps legacy community invite name previews", () => {
    const preview = formatConversationMessagePreview("Community invite: Test 8", {
      peerDisplayName: "Tester2",
      isOutgoing: false,
    });
    expect(preview).toBe("Tester2 invited you to Test 8");
  });

  it("truncates long plain text", () => {
    const preview = formatConversationMessagePreview("a".repeat(200));
    expect(preview.endsWith("...")).toBe(true);
    expect(preview.length).toBe(143);
  });

  it("formats video attachment markdown as a typed preview", () => {
    const preview = formatConversationMessagePreview(
      "[16166264_3840_2160_30fps.mp4](https://video.nostr.build/0573c24dad76da7e.mp4)",
    );
    expect(preview).toBe("Video (16166264_3840_2160_30fps.mp4)");
  });

  it("formats image and audio attachment previews", () => {
    expect(formatConversationMessagePreview(
      "[cover.jpg](https://image.nostr.build/abc123.jpg)",
    )).toBe("Image (cover.jpg)");
    expect(formatConversationMessagePreview(
      "[track.mp3](https://nostr.build/i/track.mp3)",
    )).toBe("Audio (track.mp3)");
  });

  it("formats pdf and generic file attachment previews", () => {
    expect(formatConversationMessagePreview(
      "[report.pdf](https://cdn.example.com/report.pdf)",
    )).toBe("PDF (report.pdf)");
    expect(formatConversationMessagePreview(
      "[backup.zip](https://cdn.example.com/backup.zip)",
    )).toBe(".zip backup.zip");
  });

  it("keeps leading text when attachments are present", () => {
    const preview = formatConversationMessagePreview(
      "Check this out [clip.mp4](https://video.nostr.build/clip.mp4)",
    );
    expect(preview).toBe("Check this out Video (clip.mp4)");
  });
});
