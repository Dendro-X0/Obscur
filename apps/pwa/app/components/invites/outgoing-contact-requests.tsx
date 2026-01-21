"use client";

import { useState, useEffect } from "react";
import { inviteManager } from "../../lib/invites/invite-manager";
import type { ContactRequest } from "../../lib/invites/types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type OutgoingState =
  | { status: "loading" }
  | { status: "loaded"; requests: ContactRequest[] }
  | { status: "error"; error: string };

export const OutgoingContactRequests = () => {
  const [state, setState] = useState<OutgoingState>({ status: "loading" });
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      const requests = await inviteManager.getOutgoingContactRequests();
      setState({ status: "loaded", requests });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to load outgoing requests"
      });
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const handleCancel = async (requestId: string) => {
    setCancellingId(requestId);

    try {
      await inviteManager.cancelContactRequest(requestId);
      await loadRequests(); // Reload the list
      // TODO: Show success toast
    } catch (error) {
      console.error("Failed to cancel request:", error);
      // TODO: Show error toast
    } finally {
      setCancellingId(null);
    }
  };

  if (state.status === "loading") {
    return (
      <Card title="Outgoing Requests" description="View your pending connection requests">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card title="Outgoing Requests" description="View your pending connection requests" tone="danger">
        <div className="text-sm">{state.error}</div>
      </Card>
    );
  }

  return (
    <Card title="Outgoing Requests" description="View your pending connection requests">
      {state.requests.length === 0 ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          No pending outgoing requests
        </div>
      ) : (
        <div className="space-y-3">
          {state.requests.map((request) => (
            <div
              key={request.id}
              className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/60"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      To: {request.recipientPublicKey.slice(0, 16)}...
                    </div>
                    <div className="mt-1 font-mono text-xs text-zinc-600 dark:text-zinc-400 truncate">
                      {request.recipientPublicKey}
                    </div>
                  </div>
                  <div className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    Pending
                  </div>
                </div>

                {request.message && (
                  <div className="rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900/50">
                    <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Your message:</div>
                    <div className="mt-1 text-zinc-900 dark:text-zinc-100">{request.message}</div>
                  </div>
                )}

                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Sent:</span> {request.createdAt.toLocaleString()}
                </div>

                <Button
                  onClick={() => handleCancel(request.id)}
                  variant="danger"
                  disabled={cancellingId === request.id}
                  className="w-full text-sm"
                >
                  {cancellingId === request.id ? "Cancelling..." : "Cancel Request"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
