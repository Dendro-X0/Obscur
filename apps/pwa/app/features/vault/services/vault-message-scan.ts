import { messagingDB } from "@dweb/storage/indexed-db";
import type { Message } from "@/app/features/messaging/types";
import {
  collectVaultMediaCandidates,
  type VaultMediaCandidate,
} from "./vault-media-aggregator";

export type ScanMessagesForVaultMediaOptions = Readonly<{
  /** Yield to the main thread every N messages visited (default 80). */
  yieldEvery?: number;
  isCancelled?: () => boolean;
}>;

const DEFAULT_YIELD_EVERY = 80;

/**
 * Scan the messages store with a cursor (no getAll) and collect vault media candidates.
 * Visits newest messages first when timestampMs index is available.
 */
export const scanMessagesForVaultMedia = async (
  options: ScanMessagesForVaultMediaOptions = {},
): Promise<ReadonlyArray<VaultMediaCandidate>> => {
  const yieldEvery = options.yieldEvery ?? DEFAULT_YIELD_EVERY;
  const candidates: VaultMediaCandidate[] = [];
  const batch: Message[] = [];

  const flushBatch = (): void => {
    if (batch.length === 0) {
      return;
    }
    candidates.push(...collectVaultMediaCandidates(batch));
    batch.length = 0;
  };

  const visitMessage = (raw: Message): boolean | void => {
    if (options.isCancelled?.()) {
      return false;
    }
    batch.push(raw);
    if (batch.length >= 32) {
      flushBatch();
    }
  };

  try {
    await messagingDB.forEachInStore<Message>(
      "messages",
      visitMessage,
      { indexName: "timestampMs", direction: "prev", yieldEvery },
    );
  } catch {
    await messagingDB.forEachInStore<Message>(
      "messages",
      visitMessage,
      { yieldEvery },
    );
  }

  flushBatch();
  return candidates;
};
