import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isTauri } from "@dweb/db";
import type { Message } from "@/app/features/messaging/types";
import { GroupService } from "@/app/features/groups/services/group-service";
import { commitSealedGroupMessages } from "@/app/features/groups/services/sealed-group-message-persistence";
import { createEmptyReactions } from "@/app/features/messaging/utils/logic";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";
import { logWorkspaceKernelDiagnostic } from "./workspace-kernel-diagnostics";

export type WorkspaceKernelWritePortStatus = "w2_landed";

export const workspaceKernelWritePortStatus = (): WorkspaceKernelWritePortStatus => "w2_landed";

export const WORKSPACE_KERNEL_GROUP_SEND_DEFERRED_MESSAGE =
  "Group send requires the workspace kernel write port on native desktop.";

export type WorkspaceKernelSealedEventPublisher = (
  params: Readonly<{ relayUrl: string; event: Readonly<{ id: string; created_at?: number }> }>,
) => Promise<void>;

export type SendWorkspaceKernelGroupMessageParams = Readonly<{
  conversationId: string;
  groupId: string;
  relayUrl: string;
  communityId?: string;
  publicKeyHex: PublicKeyHex;
  privateKeyHex: PrivateKeyHex;
  plaintext: string;
  replyToMessageId?: string;
  publishSealedEvent: WorkspaceKernelSealedEventPublisher;
}>;

export type SendWorkspaceKernelGroupMessageResult = Readonly<
  | { ok: true; message: Message }
  | { ok: false; errorMessage: string }
>;

export const isWorkspaceKernelWritePortReady = (): boolean => (
  isWorkspaceKernelAuthority() && isTauri()
);

/** Sole outbound managed-workspace send — sealed event → relay → SQLite append. */
export const sendWorkspaceKernelGroupMessage = async (
  params: SendWorkspaceKernelGroupMessageParams,
): Promise<SendWorkspaceKernelGroupMessageResult> => {
  if (!isWorkspaceKernelWritePortReady()) {
    return { ok: false, errorMessage: "workspace_kernel_write_port_not_ready" };
  }

  const groupService = new GroupService(params.publicKeyHex, params.privateKeyHex);
  const event = await groupService.sendSealedMessage({
    groupId: params.groupId,
    content: params.plaintext,
    replyTo: params.replyToMessageId,
  });

  try {
    await params.publishSealedEvent({ relayUrl: params.relayUrl, event });
  } catch (error) {
    logWorkspaceKernelDiagnostic("workspace.path_conflict", {
      path: "write-port.publish",
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      errorMessage: error instanceof Error ? error.message : "relay_publish_failed",
    };
  }

  const createdAtUnixSeconds = typeof event.created_at === "number"
    ? event.created_at
    : Math.floor(Date.now() / 1000);

  await commitSealedGroupMessages({
    conversationId: params.conversationId,
    groupId: params.groupId,
    communityId: params.communityId,
    publicKeyHex: params.publicKeyHex,
    messages: [{
      id: event.id,
      pubkey: params.publicKeyHex,
      created_at: createdAtUnixSeconds,
      content: params.plaintext,
    }],
  });

  const message: Message = {
    id: event.id,
    kind: "user",
    content: params.plaintext,
    timestamp: new Date(createdAtUnixSeconds * 1000),
    isOutgoing: true,
    status: "delivered",
    eventId: event.id,
    senderPubkey: params.publicKeyHex,
    reactions: createEmptyReactions(),
    replyTo: params.replyToMessageId
      ? { messageId: params.replyToMessageId, previewText: "" }
      : undefined,
  };

  return { ok: true, message };
};
