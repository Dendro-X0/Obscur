"use client";

import { useNetwork } from "@/app/features/network/providers/network-provider";
import { useRuntimeMessagingTransportOwnerController } from "@/app/features/messaging/providers/runtime-messaging-transport-owner-provider";
import { useRequestTransport } from "./use-request-transport";

/**
 * Connection-request flows on Network / Invites routes use the runtime transport
 * singleton. Do not mount a second `useEnhancedDmController` here — see N3 in
 * docs/program/navigation-performance-contract.md.
 */
export const useNetworkRequestTransport = () => {
  const dmController = useRuntimeMessagingTransportOwnerController();
  const { peerTrust, requestsInbox } = useNetwork();
  return useRequestTransport({
    dmController,
    peerTrust,
    requestsInbox,
  });
};
