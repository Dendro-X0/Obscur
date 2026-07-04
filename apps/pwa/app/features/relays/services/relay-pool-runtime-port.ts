/**
 * Relay pool runtime contract for supervisor/recovery transport paths.
 * Import this port from supervisor wiring — not UI hook pool implementations.
 */
export type {
  EnhancedRelayPoolResult as RelayPoolRuntime,
  RelayTransportActivitySnapshot,
} from "@/app/features/relays/hooks/enhanced-relay-pool-types";
