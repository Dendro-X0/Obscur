import type { Conversation } from "@/app/features/messaging/types";

export const PLACEHOLDER_DM_DISPLAY_NAMES = new Set([
  "Unknown contact",
  "Direct message",
]);

export function isPlaceholderDmDisplayName(value: string | null | undefined): boolean {
  if (!value) {
    return true;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 || PLACEHOLDER_DM_DISPLAY_NAMES.has(trimmed);
}

export type ResolveMobileThreadTitleInput = Readonly<{
  conversation: Conversation;
  resolvedDisplayName?: string | null;
  displayNameHint?: string | null;
}>;

export function resolveMobileThreadTitle(input: ResolveMobileThreadTitleInput): string {
  const { conversation } = input;
  if (conversation.kind === "group") {
    return conversation.displayName?.trim() || conversation.groupId || "Community";
  }

  for (const candidate of [
    input.resolvedDisplayName,
    input.displayNameHint,
    conversation.displayName,
  ]) {
    if (!isPlaceholderDmDisplayName(candidate)) {
      return candidate!.trim();
    }
  }

  return "Direct message";
}
