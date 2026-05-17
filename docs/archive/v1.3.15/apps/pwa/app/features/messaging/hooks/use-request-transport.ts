"use client";

import { useMemo } from "react";
import { createRequestTransportService } from "@/app/features/messaging/services/request-transport-service";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import type { UseEnhancedDMControllerResult } from "@/app/features/messaging/controllers/enhanced-dm-controller";

type UseRequestTransportParams = Readonly<{
  dmController: UseEnhancedDMControllerResult;
  peerTrust?: {
    acceptPeer: (params: Readonly<{ publicKeyHex: string }>) => void;
  };
  requestsInbox?: {
    getRequestStatus: (params: Readonly<{ peerPublicKeyHex: string }>) => Readonly<{
      status?: "pending" | "accepted" | "declined" | "canceled";
      isOutgoing: boolean;
    }> | null;
    setStatus: (params: Readonly<{
      peerPublicKeyHex: string;
      status: "pending" | "accepted" | "declined" | "canceled";
      isOutgoing?: boolean;
    }>) => void;
  };
}>;

export const useRequestTransport = (params: UseRequestTransportParams) => {
  const identity = useIdentity();

  return useMemo(() => {
    return createRequestTransportService({
      accountPublicKeyHex: identity.state.publicKeyHex ?? null,
      sendConnectionRequest: params.dmController.sendConnectionRequest,
      sendDm: params.dmController.sendDm,
      peerTrust: params.peerTrust as any,
      requestsInbox: params.requestsInbox as any,
    });
  }, [identity.state.publicKeyHex, params.dmController, params.peerTrust, params.requestsInbox]);
};
