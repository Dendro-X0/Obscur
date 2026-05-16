
import type { DeleteCommandMessage, MessageKind } from "../types";

const COMMAND_MESSAGE_PREFIX: string = "__dweb_cmd__";
const DELETE_COMMAND_PREFIX: string = "__dweb_cmd__delete:";

export const isMessageKind = (value: unknown): value is MessageKind => value === "user" || value === "command";

export const createDeleteCommandMessage = (targetMessageId: string): DeleteCommandMessage => ({ type: "delete", targetMessageId });

export const encodeCommandMessage = (payload: DeleteCommandMessage): string => `${COMMAND_MESSAGE_PREFIX}${JSON.stringify(payload)}`;

export const parseCommandMessage = (content: string): DeleteCommandMessage | null => {
    if (!content.startsWith(COMMAND_MESSAGE_PREFIX)) {
        return null;
    }
    const raw: string = content.slice(COMMAND_MESSAGE_PREFIX.length);
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null) {
            return null;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const type: unknown = (parsed as any).type;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const targetMessageId: unknown = (parsed as any).targetMessageId;
        if (type !== "delete" || typeof targetMessageId !== "string") {
            return null;
        }
        return { type, targetMessageId };
    } catch {
        return null;
    }
};

export function parseDeleteCommand(
  plaintext: string,
  tags: ReadonlyArray<ReadonlyArray<string>>
): string[] | null {
  if (plaintext.startsWith(DELETE_COMMAND_PREFIX)) {
    try {
      const parsed: unknown = JSON.parse(plaintext.slice(DELETE_COMMAND_PREFIX.length));
      if (typeof parsed !== "object" || parsed === null) {
        return null;
      }
      const command = parsed as Readonly<Record<string, unknown>>;
      if (command.type !== "message_delete_v1" || !Array.isArray(command.targetMessageIdentityIds)) {
        return null;
      }
      const targetIds = command.targetMessageIdentityIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      return targetIds.length > 0 ? Array.from(new Set(targetIds)) : null;
    } catch {
      return null;
    }
  }

  const message = parseCommandMessage(plaintext);
  if (message === null) {
    return null;
  }
  const command = message as DeleteCommandMessage;
  if (command.type !== "delete" || typeof command.targetMessageId !== "string") {
    return null;
  }
  // Extract ALL target message IDs from e tags (dm-delete-pipeline sends all targets as e tags)
  const targetIdsFromTags = tags
    .filter((tag): tag is [string, string] => tag[0] === "e" && typeof tag[1] === "string")
    .map(tag => tag[1]);
  // Return unique targets (deduplicate in case payload ID is also in tags)
  const allTargets = [...new Set([command.targetMessageId, ...targetIdsFromTags])];
  return allTargets.length > 0 ? allTargets : null;
}
