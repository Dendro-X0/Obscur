/**
 * Thread History Kernel — shared gateway contract (DM + group adapters).
 */
import type { DmConversationMaterializationPortContract } from "./dm-materialization-port-contract";

export type ThreadHistoryPortContract<TMessage = unknown> =
  DmConversationMaterializationPortContract<TMessage>;
