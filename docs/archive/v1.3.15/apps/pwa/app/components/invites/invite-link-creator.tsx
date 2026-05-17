"use client";

import { useState } from "react";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { inviteManager } from "@/app/features/invites/utils/invite-manager";
import type { InviteLink, InviteLinkOptions } from "@/app/features/invites/utils/types";
import { toast } from "../ui/toast";
import { logAppEvent } from "@/app/shared/log-app-event";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

type CreatorState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "success"; inviteLink: InviteLink }
  | { status: "error"; error: string };

export const InviteLinkCreator = () => {
  const identity = useIdentity();
  const [state, setState] = useState<CreatorState>({ status: "idle" });
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [expirationType, setExpirationType] = useState<"1h" | "1d" | "1w" | "never">("1d");
  const [maxUses, setMaxUses] = useState("");
  const [includeProfile, setIncludeProfile] = useState(true);

  const coordinationConfigured: boolean = (process.env.NEXT_PUBLIC_COORDINATION_URL ?? "").trim().length > 0;

  const canCreate = identity.state.status === "unlocked";

  const getExpirationTime = (): Date | undefined => {
    const now = new Date();
    switch (expirationType) {
      case "1h":
        return new Date(now.getTime() + 60 * 60 * 1000);
      case "1d":
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case "1w":
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case "never":
        return undefined;
    }
  };

  const handleCreate = async () => {
    if (!canCreate) return;

    setState({ status: "creating" });

    try {
      logAppEvent({
        name: "invites.link.create.start",
        level: "info",
        scope: { feature: "invites", action: "create_link" }
      });
      const options: InviteLinkOptions = {
        displayName: displayName.trim() || undefined,
        message: message.trim() || undefined,
        expirationTime: getExpirationTime(),
        maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
        includeProfile
      };

      const inviteLink = await inviteManager.generateInviteLink(options);

      setState({ status: "success", inviteLink });
      logAppEvent({
        name: "invites.link.create.success",
        level: "info",
        scope: { feature: "invites", action: "create_link" },
        context: { hasUrl: true }
      });
      toast.success("Invite link created.");
    } catch (error) {
      const message: string = error instanceof Error ? error.message : "Failed to create invite link";
      logAppEvent({
        name: "invites.link.create.failed",
        level: "error",
        scope: { feature: "invites", action: "create_link" },
        context: { error: message }
      });
      setState({
        status: "error",
        error: message
      });
      toast.error(`Invite link creation failed: ${message}`);
    }
  };

  const handleCopy = async () => {
    if (state.status !== "success") return;

    try {
      await navigator.clipboard.writeText(state.inviteLink.url);
      toast.success("Invite link copied.");
    } catch (error) {
      const message: string = error instanceof Error ? error.message : "Failed to copy link";
      logAppEvent({
        name: "invites.link.copy.failed",
        level: "error",
        scope: { feature: "invites", action: "copy_link" },
        context: { error: message }
      });
      toast.error(`Copy failed: ${message}`);
    }
  };

  const handleShare = async () => {
    if (state.status !== "success") return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Obscur Invite",
          text: "Connect with me on Obscur",
          url: state.inviteLink.url
        });
      } catch (error) {
        const message: string = error instanceof Error ? error.message : "Failed to share";
        logAppEvent({
          name: "invites.link.share.failed",
          level: "warn",
          scope: { feature: "invites", action: "share_link" },
          context: { error: message }
        });
      }
    } else {
      // Fallback to copy
      await handleCopy();
    }
  };

  const handleReset = () => {
    setState({ status: "idle" });
  };

  if (identity.state.status !== "unlocked") {
    return (
      <Card title="Create Invite Link" description="Generate a shareable link to connect with others">
        <div className="text-sm text-zinc-600 dark:text-zinc-400">
          Please unlock your identity to create invite links
        </div>
      </Card>
    );
  }

  return (
    <Card title="Create Invite Link" description="Generate a shareable link to connect with others">
      <div className="space-y-4">
        {!coordinationConfigured ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/25 dark:text-amber-100">
            <div className="font-semibold">Invite server is not configured.</div>
            <div className="mt-1 text-xs text-amber-800 dark:text-amber-200">
              Links created here will be local-only and may not redeem on other devices until <span className="font-mono">NEXT_PUBLIC_COORDINATION_URL</span> is set.
            </div>
          </div>
        ) : null}
        {state.status !== "success" && (
          <>
            <div>
              <Label htmlFor="displayName">Display Name (optional)</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                disabled={state.status === "creating"}
              />
            </div>

            <div>
              <Label htmlFor="message">Personal Message (optional)</Label>
              <Input
                id="message"
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hi, let's connect!"
                disabled={state.status === "creating"}
              />
            </div>

            <div>
              <Label htmlFor="expiration">Expiration</Label>
              <select
                id="expiration"
                value={expirationType}
                onChange={(e) => setExpirationType(e.target.value as typeof expirationType)}
                disabled={state.status === "creating"}
                className="w-full min-h-10 rounded-xl border px-3 py-2 text-sm border-black/10 bg-gradient-card text-zinc-900 dark:border-white/10 dark:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
              >
                <option value="1h">1 hour</option>
                <option value="1d">1 day</option>
                <option value="1w">1 week</option>
                <option value="never">Never</option>
              </select>
            </div>

            <div>
              <Label htmlFor="maxUses">Max Uses (optional)</Label>
              <Input
                id="maxUses"
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
                disabled={state.status === "creating"}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                id="includeProfile"
                type="checkbox"
                checked={includeProfile}
                onChange={(e) => setIncludeProfile(e.target.checked)}
                disabled={state.status === "creating"}
                className="h-4 w-4 rounded border-black/10 dark:border-white/10"
              />
              <Label htmlFor="includeProfile" className="cursor-pointer">
                Include profile information
              </Label>
            </div>

            <Button
              onClick={handleCreate}
              disabled={!canCreate || state.status === "creating"}
              className="w-full"
            >
              {state.status === "creating" ? "Creating..." : "Create Invite Link"}
            </Button>
          </>
        )}

        {state.status === "error" && (
          <div className="rounded-xl border border-red-500/30 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/25 dark:text-red-300">
            {state.error}
          </div>
        )}

        {state.status === "success" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 p-3 dark:bg-emerald-950/25">
              <div className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Invite Link Created!
              </div>
              {!coordinationConfigured ? (
                <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                  Warning: coordination is not configured, so this link may be local-only.
                </div>
              ) : null}
              <div className="mt-2 break-all font-mono text-xs text-emerald-700 dark:text-emerald-300">
                {state.inviteLink.url}
              </div>
              <div className="mt-2 space-y-1 text-xs text-emerald-700 dark:text-emerald-300">
                <div>
                  <span className="font-medium">Short Code:</span> {state.inviteLink.shortCode}
                </div>
                {state.inviteLink.expiresAt && (
                  <div>
                    <span className="font-medium">Expires:</span>{" "}
                    {state.inviteLink.expiresAt.toLocaleString()}
                  </div>
                )}
                {state.inviteLink.maxUses && (
                  <div>
                    <span className="font-medium">Max Uses:</span> {state.inviteLink.maxUses}
                  </div>
                )}
                <div>
                  <span className="font-medium">Uses:</span> {state.inviteLink.currentUses}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={handleCopy} variant="secondary" className="flex-1">
                Copy Link
              </Button>
              <Button onClick={handleShare} variant="secondary" className="flex-1">
                Share
              </Button>
            </div>

            <Button onClick={handleReset} variant="secondary" className="w-full">
              Create Another
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
