/**
 * R1 Wave 2 — DM thread-history adapter is the dm-kernel stub.
 * Thick hydrate pipeline deleted; product reads via loadDmKernelThread.
 */
import { dmKernelThreadHistoryStub } from "@/app/features/dm-kernel/dm-kernel-thread-history-stub";
import type { ThreadHistoryPort } from "./port";

export const dmThreadHistoryAdapter: ThreadHistoryPort = dmKernelThreadHistoryStub;

/** @deprecated Use dmThreadHistoryAdapter */
export const dmConversationMaterializationOwner: ThreadHistoryPort = dmThreadHistoryAdapter;
