"use client";

import React, { useMemo, useState } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import { useRequestTransport } from "@/app/features/messaging/hooks/use-request-transport";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export const ConnectionRequestInbox = () => {
  const identity = useIdentity();
  const { peerTrust, requestsInbox, blocklist } = useNetwork();
  const { relayPool } = useRelay();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dmController = useEnhancedDmController({
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
    return requestsInbox.state.items.filter((item) => !item.isOutgoing && item.status === "pending");
  }, [requestsInbox.state.items]);

  const handleAccept = async (peerPublicKeyHex: string, eventId?: string) => {
    setProcessingId(peerPublicKeyHex);
    setErrorMessage(null);
    try {
      const outcome = await requestTransport.acceptIncomingRequest({
        peerPublicKeyHex: peerPublicKeyHex as any,
        plaintext: "Accepted",
        requestEventId: eventId,
      });
      if (outcome.status === "failed") {
        throw new Error(outcome.message || "Failed to accept connection request");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to accept connection request");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (peerPublicKeyHex: string, eventId?: string, block = false) => {
    setProcessingId(peerPublicKeyHex);
    setErrorMessage(null);
    try {
      const outcome = await requestTransport.declineIncomingRequest({
        peerPublicKeyHex: peerPublicKeyHex as any,
        plaintext: block ? "Blocked" : "Declined",
        requestEventId: eventId,
      });
      if (block) {
        blocklist.addBlocked({ publicKeyInput: peerPublicKeyHex });
      }
      if (outcome.status === "failed") {
        throw new Error(outcome.message || "Failed to decline connection request");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to decline connection request");
    } finally {
      setProcessingId(null);
    }
  };

  if (!requestsInbox.hasHydrated) {
    return (
      <Card title="Connection Requests" description="Manage incoming connection requests">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
      </Card>
    );
  }

  return (
    <Card title="Connection Requests" description="Manage incoming connection requests" tone={errorMessage ? "danger" : undefined}>
      {errorMessage ? <div className="mb-3 text-sm">{errorMessage}</div> : null}
      {requests.length === 0 ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          No pending connection requests
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const displayName = `User ${request.peerPublicKeyHex.slice(0, 8)}`;
            return (
              <div
                key={request.peerPublicKeyHex}
                className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/60"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <span className="text-lg font-medium text-zinc-600 dark:text-zinc-400">
                        {displayName[0]?.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                        {displayName}
                      </div>
                      <div className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate">
                        {request.peerPublicKeyHex}
                      </div>
                    </div>
                  </div>

                  {request.lastMessagePreview ? (
                    <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900/50">
                      <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Message:</div>
                      <div className="mt-1 text-zinc-900 dark:text-zinc-100">{request.lastMessagePreview}</div>
                    </div>
                  ) : null}

                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="font-medium">Received:</span> {new Date(request.lastReceivedAtUnixSeconds * 1000).toLocaleString()}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => void handleAccept(request.peerPublicKeyHex, request.eventId)}
                      disabled={processingId === request.peerPublicKeyHex}
                      className="flex-1 text-sm"
                    >
                      {processingId === request.peerPublicKeyHex ? "Processing..." : "Accept"}
                    </Button>
                    <Button
                      onClick={() => void handleDecline(request.peerPublicKeyHex, request.eventId, false)}
                      variant="secondary"
                      disabled={processingId === request.peerPublicKeyHex}
                      className="flex-1 text-sm"
                    >
                      Decline
                    </Button>
                    <Button
                      onClick={() => void handleDecline(request.peerPublicKeyHex, request.eventId, true)}
                      variant="danger"
                      disabled={processingId === request.peerPublicKeyHex}
                      className="flex-1 text-sm"
                    >
                      Block
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};
