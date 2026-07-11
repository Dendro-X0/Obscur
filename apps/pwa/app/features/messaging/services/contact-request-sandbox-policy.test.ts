import { describe, expect, it } from "vitest";
import {
  assertDmOutboundAllowed,
  assertSandboxOutboundAllowed,
  CONTACT_REQUEST_SANDBOX_MAX_CHARS,
  resolveContactRequestComposeMode,
  resolveDmOutboundLifecycleTag,
} from "./contact-request-sandbox-policy";

describe("contact-request-sandbox-policy (ASE-1d-c)", () => {
  it("returns sandbox_text while handshake is pending", () => {
    expect(resolveContactRequestComposeMode({
      isPeerAcceptedByTrust: false,
      requestStatus: { isOutgoing: true, status: "pending" },
    })).toBe("sandbox_text");
    expect(resolveContactRequestComposeMode({
      isPeerAcceptedByTrust: false,
      requestStatus: { isOutgoing: false, status: "pending" },
    })).toBe("sandbox_text");
  });

  it("returns full for accepted trust or request status", () => {
    expect(resolveContactRequestComposeMode({
      isPeerAcceptedByTrust: true,
      requestStatus: null,
    })).toBe("full");
    expect(resolveContactRequestComposeMode({
      isPeerAcceptedByTrust: false,
      requestStatus: { isOutgoing: false, status: "accepted" },
    })).toBe("full");
  });

  it("blocks strangers without a pending handshake", () => {
    expect(resolveContactRequestComposeMode({
      isPeerAcceptedByTrust: false,
      requestStatus: null,
    })).toBe("blocked");
  });

  it("allows text-only sandbox outbound within the character budget", () => {
    expect(assertSandboxOutboundAllowed({
      plaintext: "Who referred you?",
      attachmentCount: 0,
    }).ok).toBe(true);
  });

  it("rejects attachments and long sandbox text offline", () => {
    expect(assertSandboxOutboundAllowed({
      plaintext: "hello",
      attachmentCount: 1,
    })).toMatchObject({ ok: false, reasonCode: "sandbox_attachment_blocked" });
    expect(assertSandboxOutboundAllowed({
      plaintext: "x".repeat(CONTACT_REQUEST_SANDBOX_MAX_CHARS + 1),
      attachmentCount: 0,
    })).toMatchObject({ ok: false, reasonCode: "sandbox_text_too_long" });
  });
});

describe("contact-request-sandbox-policy (ASE-1d-d)", () => {
  it("resolves outbound lifecycle tags", () => {
    expect(resolveDmOutboundLifecycleTag([["t", "connection-qna"]])).toBe("connection-qna");
    expect(resolveDmOutboundLifecycleTag([["t", "voice-call-invite"]])).toBe("voice-call-invite");
  });

  it("blocks untagged stranger DMs at the canonical outbound gate", () => {
    expect(assertDmOutboundAllowed({
      composeMode: "blocked",
      plaintext: "hey",
      attachmentCount: 0,
    })).toMatchObject({ ok: false, reasonCode: "stranger_dm_blocked" });
  });

  it("allows connection-request while blocked", () => {
    expect(assertDmOutboundAllowed({
      composeMode: "blocked",
      plaintext: "I'd like to connect",
      attachmentCount: 0,
      customTags: [["t", "connection-request"]],
    }).ok).toBe(true);
  });

  it("requires connection-qna tag for sandbox replies", () => {
    expect(assertDmOutboundAllowed({
      composeMode: "sandbox_text",
      plaintext: "Who referred you?",
      attachmentCount: 0,
    })).toMatchObject({ ok: false, reasonCode: "sandbox_plain_dm_blocked" });
    expect(assertDmOutboundAllowed({
      composeMode: "sandbox_text",
      plaintext: "Who referred you?",
      attachmentCount: 0,
      customTags: [["t", "connection-qna"]],
    }).ok).toBe(true);
  });

  it("blocks voice protocol traffic during sandbox", () => {
    expect(assertDmOutboundAllowed({
      composeMode: "sandbox_text",
      plaintext: JSON.stringify({ type: "voice-call-invite", roomId: "room-1" }),
      attachmentCount: 0,
      customTags: [["t", "voice-call-invite"]],
    })).toMatchObject({ ok: false, reasonCode: "sandbox_voice_blocked" });
  });

  it("allows delete commands regardless of compose mode", () => {
    expect(assertDmOutboundAllowed({
      composeMode: "blocked",
      plaintext: '__dweb_cmd__delete:{"type":"message_delete_v1","targetMessageIdentityIds":["abc"]}',
      attachmentCount: 0,
    }).ok).toBe(true);
  });

  it("blocks secret material in full compose mode", () => {
    const sampleNsec = "nsec1p578aq7jtr2ggep0s9kch0c60uvwd0kewa8v6w0gzuxy4dgt9paj0qut0mth";
    expect(assertDmOutboundAllowed({
      composeMode: "full",
      plaintext: `Do not share ${sampleNsec} in chat`,
      attachmentCount: 0,
    })).toMatchObject({ ok: false, reasonCode: "secret_material_blocked" });
  });
});
