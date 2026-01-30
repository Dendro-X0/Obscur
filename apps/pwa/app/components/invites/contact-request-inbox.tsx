"use client";

import { useState, useEffect } from "react";
import { inviteManager } from "@/app/features/invites/utils/invite-manager";
import type { ContactRequest } from "@/app/features/invites/utils/types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type InboxState =
  | { status: "loading" }
  | { status: "loaded"; requests: ContactRequest[] }
  | { status: "error"; error: string };

export const ContactRequestInbox = () => {
  const [state, setState] = useState<InboxState>({ status: "loading" });
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      const requests = await inviteManager.getIncomingContactRequests();
      setState({ status: "loaded", requests });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to load contact requests"
      });
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const handleAccept = async (requestId: string) => {
    setProcessingId(requestId);

    try {
      await inviteManager.acceptContactRequest(requestId);
      await loadRequests(); // Reload the list
      // TODO: Show success toast
    } catch (error) {
      console.error("Failed to accept request:", error);
      // TODO: Show error toast
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (requestId: string, block: boolean = false) => {
    setProcessingId(requestId);

    try {
      await inviteManager.declineContactRequest(requestId, block);
      await loadRequests(); // Reload the list
      // TODO: Show success toast
    } catch (error) {
      console.error("Failed to decline request:", error);
      // TODO: Show error toast
    } finally {
      setProcessingId(null);
    }
  };

  if (state.status === "loading") {
    return (
      <Card title="Contact Requests" description="Manage incoming connection requests">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card title="Contact Requests" description="Manage incoming connection requests" tone="danger">
        <div className="text-sm">{state.error}</div>
      </Card>
    );
  }

  return (
    <Card title="Contact Requests" description="Manage incoming connection requests">
      {state.requests.length === 0 ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          No pending contact requests
        </div>
      ) : (
        <div className="space-y-3">
          {state.requests.map((request) => (
            <div
              key={request.id}
              className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/60"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  {request.profile.avatar ? (
                    <img
                      src={request.profile.avatar}
                      alt={request.profile.displayName || "User"}
                      className="h-12 w-12 rounded-full"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <span className="text-lg font-medium text-zinc-600 dark:text-zinc-400">
                        {(request.profile.displayName || "U")[0].toUpperCase()}
                      </span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100">
                      {request.profile.displayName || `User ${request.senderPublicKey.slice(0, 8)}...`}
                    </div>
                    <div className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate">
                      {request.senderPublicKey}
                    </div>
                    {request.profile.bio && (
                      <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                        {request.profile.bio}
                      </div>
                    )}
                  </div>
                </div>

                {request.message && (
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900/50">
                    <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Message:</div>
                    <div className="mt-1 text-zinc-900 dark:text-zinc-100">{request.message}</div>
                  </div>
                )}

                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Received:</span> {request.createdAt.toLocaleString()}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAccept(request.id)}
                    disabled={processingId === request.id}
                    className="flex-1 text-sm"
                  >
                    {processingId === request.id ? "Processing..." : "Accept"}
                  </Button>
                  <Button
                    onClick={() => handleDecline(request.id, false)}
                    variant="secondary"
                    disabled={processingId === request.id}
                    className="flex-1 text-sm"
                  >
                    Decline
                  </Button>
                  <Button
                    onClick={() => handleDecline(request.id, true)}
                    variant="danger"
                    disabled={processingId === request.id}
                    className="flex-1 text-sm"
                  >
                    Block
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
