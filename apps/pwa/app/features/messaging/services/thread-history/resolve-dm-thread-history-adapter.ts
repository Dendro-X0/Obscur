import { dmKernelThreadHistoryStub } from "@/app/features/dm-kernel/dm-kernel-thread-history-stub";
import type { ThreadHistoryPort } from "./port";

/**
 * Single DM materialization entry — always dm-kernel stub (R1 Wave 2).
 * Legacy hydrate pipeline deleted; no ALLOW_LEGACY thick adapter path.
 */
export const resolveDmThreadHistoryAdapter = (): ThreadHistoryPort => (
  dmKernelThreadHistoryStub
);
