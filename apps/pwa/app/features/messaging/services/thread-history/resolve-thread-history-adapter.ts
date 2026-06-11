import type { ThreadKind } from "./contracts";
import { dmThreadHistoryAdapter } from "./dm-adapter";
import { groupThreadHistoryAdapter } from "./group-adapter";
import type { ThreadHistoryPort } from "./port";

export const resolveThreadHistoryAdapter = (kind: ThreadKind): ThreadHistoryPort => (
  kind === "group" ? groupThreadHistoryAdapter : dmThreadHistoryAdapter
);
