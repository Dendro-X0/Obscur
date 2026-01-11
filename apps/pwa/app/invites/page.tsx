"use client";

import type React from "react";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "../components/page-shell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { IdentityCard } from "../components/identity-card";
import { useIdentity } from "../lib/use-identity";
import { useInvites } from "../lib/use-invites";
import useNavBadges from "../lib/use-nav-badges";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type Invite = Readonly<{
  id: string;
  relayUrl: string;
  groupId: string;
  host: string;
  identifier: string;
  inviterPublicKeyHex?: string;
  label?: string;
  createdAtUnixMs: number;
}>;

const formatDate = (unixMs: number): string => {
  const d: Date = new Date(unixMs);
  return d.toISOString();
};

export default function InvitesPage(): React.JSX.Element {
  const router = useRouter();
  const identity = useIdentity();
  const publicKeyHex: string | null = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
  const navBadges = useNavBadges({ publicKeyHex: (publicKeyHex as PublicKeyHex | null) ?? null });
  const invites = useInvites({ publicKeyHex });
  const sortedInvites: ReadonlyArray<Invite> = useMemo((): ReadonlyArray<Invite> => {
    return [...invites.state.items].sort((a: Invite, b: Invite): number => b.createdAtUnixMs - a.createdAtUnixMs);
  }, [invites.state.items]);

  const handleCopyInviteLink = (invite: Invite): void => {
    const nextUrl: URL = new URL("/invite", window.location.origin);
    nextUrl.searchParams.set("relay", invite.relayUrl);
    nextUrl.searchParams.set("group", invite.groupId);
    if (invite.inviterPublicKeyHex) {
      nextUrl.searchParams.set("inviter", invite.inviterPublicKeyHex);
    }
    if (invite.label) {
      nextUrl.searchParams.set("name", invite.label);
    }
    void navigator.clipboard.writeText(nextUrl.toString());
  };

  return (
    <PageShell title="Invites" navBadgeCounts={navBadges.navBadgeCounts}>
      <div className="mx-auto w-full max-w-3xl p-4">
        {!publicKeyHex ? (
          <Card title="No identity" description="Create an identity to store invites under a persona." className="w-full">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => router.push("/settings")}>Settings</Button>
              <Button type="button" variant="secondary" onClick={() => router.push("/search")}>Search</Button>
            </div>
            <div className="pt-3">
              <IdentityCard />
            </div>
          </Card>
        ) : sortedInvites.length === 0 ? (
          <Card title="No invites" description="Paste an invite link to add a community." className="w-full">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => router.push("/search")}>Search</Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedInvites.map((invite: Invite) => (
              <Card key={invite.id} title={invite.label ?? invite.groupId} description={invite.host} className="w-full">
                <div className="space-y-2">
                  <div className="font-mono text-xs wrap-break-word text-zinc-700 dark:text-zinc-300">{invite.identifier}</div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">Saved: {formatDate(invite.createdAtUnixMs)}</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        router.push(`/groups/${encodeURIComponent(invite.identifier)}`);
                      }}
                    >
                      Open
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        handleCopyInviteLink(invite);
                      }}
                    >
                      Copy link
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        invites.removeInvite({ id: invite.id });
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
