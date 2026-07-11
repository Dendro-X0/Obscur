"use client";

import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { useNetworkRequestTransport } from "@/app/features/messaging/hooks/use-network-request-transport";
import {
  buildIdentityBindingViewModel,
  IdentityBindingAcceptDialog,
  IdentityBindingPanel,
} from "@/app/features/security";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

export const ConnectionRequestInbox = () => {
  const { t } = useTranslation();
  const { peerTrust, requestsInbox, blocklist } = useNetwork();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acceptTargetPubkey, setAcceptTargetPubkey] = useState<string | null>(null);
  const [acceptTargetEventId, setAcceptTargetEventId] = useState<string | undefined>(undefined);

  const requestTransport = useNetworkRequestTransport();

  const requests = useMemo(() => {
    return requestsInbox.state.items.filter((item) => !item.isOutgoing && item.status === "pending");
  }, [requestsInbox.state.items]);

  const acceptBinding = acceptTargetPubkey
    ? buildIdentityBindingViewModel({
      publicKeyHex: acceptTargetPubkey,
      resolverSource: "connection_request",
    })
    : null;

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
      setAcceptTargetPubkey(null);
      setAcceptTargetEventId(undefined);
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
    <>
      <Card title="Connection Requests" description="Manage incoming connection requests" tone={errorMessage ? "danger" : undefined}>
        {errorMessage ? <div className="mb-3 text-sm">{errorMessage}</div> : null}
        {requests.length === 0 ? (
          <div className="text-sm text-zinc-600 dark:text-zinc-400">
            No pending connection requests
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const binding = buildIdentityBindingViewModel({
                publicKeyHex: request.peerPublicKeyHex,
                resolverSource: "connection_request",
              });
              return (
                <div
                  key={request.peerPublicKeyHex}
                  className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/60"
                >
                  <div className="space-y-3">
                    {binding ? (
                      <IdentityBindingPanel binding={binding} compact showLiteracyNote={false} />
                    ) : null}

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
                        onClick={() => {
                          setAcceptTargetPubkey(request.peerPublicKeyHex);
                          setAcceptTargetEventId(request.eventId);
                        }}
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

      <IdentityBindingAcceptDialog
        isOpen={Boolean(acceptTargetPubkey)}
        binding={acceptBinding}
        title={t("security.identityBinding.accept.title")}
        isSubmitting={Boolean(acceptTargetPubkey && processingId === acceptTargetPubkey)}
        onClose={() => {
          if (!processingId) {
            setAcceptTargetPubkey(null);
            setAcceptTargetEventId(undefined);
          }
        }}
        onConfirm={async () => {
          if (!acceptTargetPubkey) {
            return;
          }
          await handleAccept(acceptTargetPubkey, acceptTargetEventId);
        }}
      />
    </>
  );
};
