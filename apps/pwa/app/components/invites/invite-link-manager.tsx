"use client";

import { useState, useEffect } from "react";
import { inviteManager } from "../../lib/invites/invite-manager";
import type { InviteLink } from "../../lib/invites/types";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type ManagerState =
  | { status: "loading" }
  | { status: "loaded"; links: InviteLink[] }
  | { status: "error"; error: string };

export const InviteLinkManager = () => {
  const [state, setState] = useState<ManagerState>({ status: "loading" });
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadLinks = async () => {
    try {
      // TODO: Implement getAllInviteLinks method in invite manager
      // For now, we'll show an empty state
      setState({ status: "loaded", links: [] });
    } catch (error) {
      setState({
        status: "error",
        error: error instanceof Error ? error.message : "Failed to load invite links"
      });
    }
  };

  useEffect(() => {
    void loadLinks();
  }, []);

  const handleRevoke = async (linkId: string) => {
    setRevokingId(linkId);

    try {
      await inviteManager.revokeInviteLink(linkId);
      await loadLinks(); // Reload the list
    } catch (error) {
      console.error("Failed to revoke link:", error);
      // TODO: Show error toast
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      // TODO: Show toast notification
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  if (state.status === "loading") {
    return (
      <Card title="Manage Invite Links" description="View and manage your active invite links">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading...</div>
      </Card>
    );
  }

  if (state.status === "error") {
    return (
      <Card title="Manage Invite Links" description="View and manage your active invite links" tone="danger">
        <div className="text-sm">{state.error}</div>
      </Card>
    );
  }

  return (
    <Card title="Manage Invite Links" description="View and manage your active invite links">
      {state.links.length === 0 ? (
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          No active invite links. Create one to get started!
        </div>
      ) : (
        <div className="space-y-3">
          {state.links.map((link) => (
            <div
              key={link.id}
              className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/60"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 break-all font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {link.url}
                  </div>
                  <div
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      link.isActive
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                    }`}
                  >
                    {link.isActive ? "Active" : "Revoked"}
                  </div>
                </div>

                <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                  <div>
                    <span className="font-medium">Short Code:</span> {link.shortCode}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span> {link.createdAt.toLocaleString()}
                  </div>
                  {link.expiresAt && (
                    <div>
                      <span className="font-medium">Expires:</span> {link.expiresAt.toLocaleString()}
                    </div>
                  )}
                  <div>
                    <span className="font-medium">Uses:</span> {link.currentUses}
                    {link.maxUses && ` / ${link.maxUses}`}
                  </div>
                  {link.message && (
                    <div>
                      <span className="font-medium">Message:</span> {link.message}
                    </div>
                  )}
                </div>

                {link.isActive && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleCopy(link.url)}
                      variant="secondary"
                      className="flex-1 text-xs"
                    >
                      Copy
                    </Button>
                    <Button
                      onClick={() => handleRevoke(link.id)}
                      variant="danger"
                      disabled={revokingId === link.id}
                      className="flex-1 text-xs"
                    >
                      {revokingId === link.id ? "Revoking..." : "Revoke"}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
