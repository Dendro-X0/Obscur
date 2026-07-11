import {
  assertNoBlockedSecretMaterial,
  SECRET_INPUT_FIREWALL_MESSAGE,
} from "@/app/features/security/services/secret-input-firewall";
import {
  isPendingContactHandshake,
  type DmPeerRequestStatusSnapshot,
} from "./dm-peer-established-ui";

export const CONTACT_REQUEST_SANDBOX_MAX_CHARS = 500;

export type ContactRequestComposeMode = "blocked" | "sandbox_text" | "full";

export type SandboxOutboundRejection = Readonly<{
  ok: false;
  reasonCode: "sandbox_attachment_blocked" | "sandbox_voice_blocked" | "sandbox_empty" | "sandbox_text_too_long";
  message: string;
}>;

export type DmOutboundRejection = Readonly<{
  ok: false;
  reasonCode:
    | SandboxOutboundRejection["reasonCode"]
    | "stranger_dm_blocked"
    | "sandbox_plain_dm_blocked"
    | "sandbox_protocol_blocked"
    | "secret_material_blocked";
  message: string;
}>;

const CONNECTION_LIFECYCLE_TAGS = new Set([
  "connection-request",
  "connection-qna",
  "connection-accept",
  "connection-decline",
  "connection-cancel",
  "connection-received",
  "connection-receipt",
]);

const VOICE_PROTOCOL_TAGS = new Set([
  "voice-call-signal",
  "voice-call-invite",
]);

export const resolveDmOutboundLifecycleTag = (
  customTags?: ReadonlyArray<ReadonlyArray<string>>,
): string | null => {
  const lifecycleTag = customTags?.find((tag) => tag[0] === "t")?.[1];
  if (!lifecycleTag) {
    return null;
  }
  if (
    CONNECTION_LIFECYCLE_TAGS.has(lifecycleTag)
    || VOICE_PROTOCOL_TAGS.has(lifecycleTag)
    || lifecycleTag === "message-delete"
  ) {
    return lifecycleTag;
  }
  return null;
};

const isDeleteCommandPlaintext = (plaintext: string): boolean => {
  const trimmed = plaintext.trimStart();
  return trimmed.startsWith("__dweb_cmd__");
};

const isStructuredProtocolPlaintext = (plaintext: string): boolean => {
  const trimmed = plaintext.trimStart();
  if (!trimmed.startsWith("{")) {
    return false;
  }
  try {
    const parsed = JSON.parse(trimmed) as { type?: unknown; signalType?: unknown };
    if (parsed?.type === "community-invite-response") {
      return true;
    }
    if (parsed?.type === "voice-call-invite") {
      return true;
    }
    if (typeof parsed?.signalType === "string") {
      return true;
    }
  } catch {
    // not protocol JSON
  }
  return false;
};

export const resolveContactRequestComposeMode = (params: Readonly<{
  isPeerAcceptedByTrust: boolean;
  requestStatus: DmPeerRequestStatusSnapshot;
}>): ContactRequestComposeMode => {
  if (params.isPeerAcceptedByTrust) {
    return "full";
  }
  if (params.requestStatus?.status === "accepted") {
    return "full";
  }
  if (isPendingContactHandshake(params.requestStatus)) {
    return "sandbox_text";
  }
  return "blocked";
};

export const assertSandboxOutboundAllowed = (params: Readonly<{
  plaintext: string;
  attachmentCount: number;
  hasVoiceNote?: boolean;
}>): Readonly<{ ok: true } | SandboxOutboundRejection> => {
  if (params.attachmentCount > 0) {
    return {
      ok: false,
      reasonCode: "sandbox_attachment_blocked",
      message: "Attachments are blocked until this contact request is accepted.",
    };
  }
  if (params.hasVoiceNote) {
    return {
      ok: false,
      reasonCode: "sandbox_voice_blocked",
      message: "Voice notes are blocked until this contact request is accepted.",
    };
  }
  const trimmed = params.plaintext.trim();
  if (!trimmed) {
    return {
      ok: false,
      reasonCode: "sandbox_empty",
      message: "Enter a message to send.",
    };
  }
  if (trimmed.length > CONTACT_REQUEST_SANDBOX_MAX_CHARS) {
    return {
      ok: false,
      reasonCode: "sandbox_text_too_long",
      message: `Keep request replies under ${CONTACT_REQUEST_SANDBOX_MAX_CHARS} characters.`,
    };
  }
  return { ok: true };
};

/** Canonical offline outbound gate for every dmController.sendDm path (ASE-1d-d). */
export const assertDmOutboundAllowed = (params: Readonly<{
  composeMode: ContactRequestComposeMode;
  plaintext: string;
  attachmentCount: number;
  hasVoiceNote?: boolean;
  customTags?: ReadonlyArray<ReadonlyArray<string>>;
}>): Readonly<{ ok: true } | DmOutboundRejection> => {
  const lifecycleTag = resolveDmOutboundLifecycleTag(params.customTags);
  const isDeleteCommand = isDeleteCommandPlaintext(params.plaintext);
  const isStructuredProtocol = isStructuredProtocolPlaintext(params.plaintext);

  if (isDeleteCommand || lifecycleTag === "message-delete") {
    return { ok: true };
  }

  if (params.composeMode === "full") {
    if (!lifecycleTag && !isStructuredProtocol) {
      const secretBlock = assertNoBlockedSecretMaterial(params.plaintext, "message");
      if (!secretBlock.ok) {
        return {
          ok: false,
          reasonCode: "secret_material_blocked",
          message: SECRET_INPUT_FIREWALL_MESSAGE.messageBlocked,
        };
      }
    }
    return { ok: true };
  }

  if (params.composeMode === "blocked") {
    if (lifecycleTag === "connection-request") {
      return { ok: true };
    }
    if (
      lifecycleTag === "connection-accept"
      || lifecycleTag === "connection-decline"
      || lifecycleTag === "connection-cancel"
    ) {
      return { ok: true };
    }
    return {
      ok: false,
      reasonCode: "stranger_dm_blocked",
      message: "Send a connection request before messaging this person.",
    };
  }

  if (
    lifecycleTag === "connection-accept"
    || lifecycleTag === "connection-decline"
    || lifecycleTag === "connection-cancel"
  ) {
    return { ok: true };
  }

  if (lifecycleTag && VOICE_PROTOCOL_TAGS.has(lifecycleTag)) {
    return {
      ok: false,
      reasonCode: "sandbox_voice_blocked",
      message: "Voice calls are blocked until this contact request is accepted.",
    };
  }

  if (isStructuredProtocol) {
    return {
      ok: false,
      reasonCode: "sandbox_protocol_blocked",
      message: "Only request Q&A is allowed until this contact request is accepted.",
    };
  }

  if (lifecycleTag !== "connection-qna") {
    return {
      ok: false,
      reasonCode: "sandbox_plain_dm_blocked",
      message: "Only request Q&A replies are allowed until this contact request is accepted.",
    };
  }

  const sandboxCheck = assertSandboxOutboundAllowed({
    plaintext: params.plaintext,
    attachmentCount: params.attachmentCount,
    hasVoiceNote: params.hasVoiceNote,
  });
  if (!sandboxCheck.ok) {
    return sandboxCheck;
  }

  const secretBlock = assertNoBlockedSecretMaterial(params.plaintext, "message");
  if (!secretBlock.ok) {
    return {
      ok: false,
      reasonCode: "secret_material_blocked",
      message: SECRET_INPUT_FIREWALL_MESSAGE.messageBlocked,
    };
  }

  return { ok: true };
};
