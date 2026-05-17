"use client";

import { useMemo, useState } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useEnhancedDMController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import { useRequestTransport } from "@/app/features/messaging/hooks/use-request-transport";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export const OutgoingConnectionRequests = () => {
  const identity = useIdentity();
  const { peerTrust, requestsInbox, blocklist } = useNetwork();
  const { relayPool } = useRelay();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dmController = useEnhancedDMController({
    myPublicKeyHex: identity.state.publicKeyHex || null,
    myPrivateKeyHex: identity.state.privateKeyHex || null,
    pool: relayPool,
    blocklist,
    peerTrust,
    requestsInbox,
    autoSubscribeIncoming: false,
    enableIncomingTransport: false,
    enableAutoQueueProcessing: false,
  });
  const requestTransport = useRequestTransport({
    dmController,
    peerTrust,
    requestsInbox,
  });

  const requests = useMemo(() => {
    return requestsInbox.state.items.filter((item) => item.isOutgoing && item.status === "pending");
  }, [requestsInbox.state.items]);

  const handleCancel = async (peerPublicKeyHex: string, eventId?: string) => {
    setCancellingId(peerPublicKeyHex);
    setErrorMessage(null);
    try {
      const outcome = await requestTransport.cancelOutgoingRequest({
        peerPublicKeyHex: peerPublicKeyHex as any,
        plaintext: "Canceled",
        requestEventId: eventId,
      });
      if (outcome.status === "failed") {
        throw new Error(outcome.message || "Failed to cancel connection request");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to cancel connection request");
    } finally {
      setCancellingId(null);
    }
  };

  if (!requestsInbox.hasHydrated) {
    return (
      <Card title="Outgoing Requests" description="View your pending connection requests">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
      </Card>
    );
  }

  return (
    <Card title="Outgoing Requests" description="View your pending connection requests" tone={errorMessage ? "danger" : undefined}>
      {errorMessage ? <div className="mb-3 text-sm">{errorMessage}</div> : null}
      {requests.length === 0 ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          No pending outgoing requests
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.peerPublicKeyHex}
              className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/60"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      To: Unknown contact
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400 truncate">
                      Identity hidden
                    </div>
                  </div>
                  <div className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    Pending
                  </div>
                </div>

                {request.lastMessagePreview ? (
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900/50">
                    <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Your message:</div>
                    <div className="mt-1 text-zinc-900 dark:text-zinc-100">{request.lastMessagePreview}</div>
                  </div>
                ) : null}

                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Sent:</span> {new Date(request.lastReceivedAtUnixSeconds * 1000).toLocaleString()}
                </div>

                <Button
                  onClick={() => void handleCancel(request.peerPublicKeyHex, request.eventId)}
                  variant="danger"
                  disabled={cancellingId === request.peerPublicKeyHex}
                  className="w-full text-sm"
                >
                  {cancellingId === request.peerPublicKeyHex ? "Cancelling..." : "Cancel Request"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
