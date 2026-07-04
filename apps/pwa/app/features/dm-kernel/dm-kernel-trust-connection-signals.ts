import type { IncomingRequestAntiAbusePeerSnapshot } from "@/app/features/messaging/services/incoming-request-anti-abuse";

/** Peer hit connection-request rate window or is in post-burst cooldown (anti-abuse owner). */
export const detectConnectionRequestBurstSignal = (
  snapshot: IncomingRequestAntiAbusePeerSnapshot,
): boolean => (
  snapshot.cooldownActive
  || snapshot.peerWindowCount >= snapshot.peerLimit
);
