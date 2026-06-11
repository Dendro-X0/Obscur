import type { FullClientGateway } from "@dweb/client-gateway/app-extensions";
import type { CommunityRosterMaterializationPort } from "@/app/features/groups/services/community-roster-materialization-port";
import type { ThreadHistoryPort } from "@/app/features/messaging/services/thread-history/port";

/** Typed PWA gateway (R1/R2 ports satisfy `@dweb/client-gateway` extension contracts). */
export type AppClientGateway = FullClientGateway<
  ThreadHistoryPort,
  CommunityRosterMaterializationPort
>;
