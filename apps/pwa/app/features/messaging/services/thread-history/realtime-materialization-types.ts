/**
 * Thread history realtime merge contracts — shared by port and dm-kernel stub.
 */
import type { Message } from "../../types";
import type { MessageBusEvent } from "../message-bus";

export type DeleteTombstones = Map<string, number>;

export type ApplyRealtimeBufferedEventsParams = Readonly<{
  previous: ReadonlyArray<Message>;
  events: ReadonlyArray<MessageBusEvent>;
  chatPerformanceV2Enabled: boolean;
  allowExpandedHistory: boolean;
  tombstones?: DeleteTombstones;
  nowMs?: number;
  myPublicKeyHex?: string | null;
  persistentSuppressedMessageIds?: ReadonlySet<string>;
  liveWindowSoftLimit?: number;
}>;
