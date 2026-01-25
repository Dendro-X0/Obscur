import { useEnhancedRelayPool } from "./enhanced-relay-pool";
import type { RelayConnection } from "./relay-connection";

export type RelayPoolResult = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
  sendToOpen: (payload: string) => void;
  broadcastEvent: (payload: string) => Promise<any>;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
}>;

/**
 * Compatibility wrapper for the basic useRelayPool hook.
 * Now powered by the EnhancedRelayPool logic underneath.
 */
export const useRelayPool = (urls: ReadonlyArray<string>): RelayPoolResult => {
  const enhanced = useEnhancedRelayPool(urls);

  return {
    connections: enhanced.connections,
    sendToOpen: enhanced.sendToOpen,
    broadcastEvent: enhanced.broadcastEvent,
    subscribeToMessages: enhanced.subscribeToMessages
  };
};
