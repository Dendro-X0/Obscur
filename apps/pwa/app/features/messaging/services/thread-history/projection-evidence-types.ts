/**
 * Thread history projection evidence contracts — shared by port and legacy impl.
 */
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AccountProjectionSnapshot } from "@/app/features/account-sync/account-event-contracts";
import type { Message } from "../../types";

export type BuildProjectionEvidenceMessagesParams = Readonly<{
  conversationId: string | null | undefined;
  publicKeyHex: PublicKeyHex | string | null | undefined;
  projection: AccountProjectionSnapshot | null;
  limit: number;
  persistentSuppressedMessageIds: ReadonlySet<string>;
  localMessageRetentionDays: number | undefined;
  normalizeRow: (entry: Message) => Message;
}>;
