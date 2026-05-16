"use client";

import { useMemo } from "react";
import { createRequestTransportService } from "@/app/features/messaging/services/request-transport-service";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useWindowRuntimeSnapshot } from "@/app/features/runtime/services/window-runtime-supervisor";
type DmControllerMinimal = Readonly<{
  sendConnectionRequest: (params: Readonly<{
    peerPublicKeyHex: string;
    introMessage?: string;
  }>) => Promise<{ success: boolean; deliveryStatus?: string; messageId: string; relayResults: ReadonlyArray<{ relayUrl: string; success: boolean; error?: string }> }>;
  sendDm: (params: Readonly<{
    peerPublicKeyInput: string;
    plaintext: string;
    customTags?: string[][];
  }>) => Promise<{ success: boolean; deliveryStatus?: string; messageId: string; relayResults: ReadonlyArray<{ relayUrl: string; success: boolean; error?: string }> }>;
}>;

type UseRequestTransportParams = Readonly<{
  dmController: DmControllerMinimal;
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
  const runtimeSnapshot = useWindowRuntimeSnapshot();
  const profileId = runtimeSnapshot.session.profileId?.trim() || undefined;

  return useMemo(() => {
    return createRequestTransportService({
      profileId,
      accountPublicKeyHex: identity.state.publicKeyHex ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendConnectionRequest: params.dmController.sendConnectionRequest as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sendDm: params.dmController.sendDm as any,
      peerTrust: params.peerTrust as any,
      requestsInbox: params.requestsInbox as any,
    });
  }, [identity.state.publicKeyHex, profileId, params.dmController, params.peerTrust, params.requestsInbox]);
};
