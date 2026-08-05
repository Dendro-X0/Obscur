import { dmKernelThreadHistoryStub } from "@/app/features/dm-kernel/dm-kernel-thread-history-stub";
import type { ThreadHistoryPort } from "./port";

/**
 * Vitest alias target — matches production always-stub resolver (R1 Wave 2).
 */
export const resolveDmThreadHistoryAdapter = (): ThreadHistoryPort => (
  dmKernelThreadHistoryStub
);
