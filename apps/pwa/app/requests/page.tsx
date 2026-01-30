"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { PageShell } from "../components/page-shell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { EmptyState } from "../components/ui/empty-state";
import { cn } from "@/app/lib/utils";
import { useBlocklist } from "@/app/features/contacts/hooks/use-blocklist";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { usePeerTrust } from "@/app/features/contacts/hooks/use-peer-trust";
import { useRequestsInbox } from "@/app/features/messaging/hooks/use-requests-inbox";
import { IdentityCard } from "../components/identity-card";

export default function RequestsPage(): React.JSX.Element {
  const router = useRouter();
  const identity = useIdentity();
  const publicKeyHex: PublicKeyHex | null = (identity.state.publicKeyHex as PublicKeyHex | null) ?? null;
  const peerTrust = usePeerTrust({ publicKeyHex });
  const requestsInbox = useRequestsInbox({ publicKeyHex });
  const blocklist = useBlocklist({ publicKeyHex });
  const [revealedByPubkey, setRevealedByPubkey] = useState<Readonly<Record<string, boolean>>>({});

  const requestsUnreadCount: number = useMemo((): number => {
    return requestsInbox.state.items.reduce((sum: number, item: Readonly<{ unreadCount: number }>): number => sum + item.unreadCount, 0);
  }, [requestsInbox.state.items]);

  const sortedItems = useMemo(() => {
    return [...requestsInbox.state.items].sort((a, b) => b.lastReceivedAtUnixSeconds - a.lastReceivedAtUnixSeconds);
  }, [requestsInbox.state.items]);

  return (
    <PageShell title="Requests" navBadgeCounts={{ "/requests": requestsUnreadCount }}>
      <div className="mx-auto w-full max-w-3xl p-4">
        {identity.state.status !== "unlocked" ? (
          <Card title="Identity locked" description="Unlock your identity to manage requests." className="w-full">
            <div className="space-y-2">
              <div className="text-sm text-zinc-700 dark:text-zinc-300">Requests are stored locally per identity.</div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => router.push("/settings")}>
                  Open Settings
                </Button>
                <Button type="button" variant="secondary" onClick={() => router.push("/")}>
                  Back to chats
                </Button>
              </div>
              <div className="pt-2">
                <IdentityCard />
              </div>
            </div>
          </Card>
        ) : sortedItems.length === 0 ? (
          <EmptyState
            type="requests"
            actions={[
              {
                label: "Back to chats",
                onClick: () => router.push("/"),
                variant: "primary"
              },
              {
                label: "Open Settings",
                onClick: () => router.push("/settings"),
                variant: "secondary"
              }
            ]}
          />
        ) : (
          <div className="space-y-3">
            {sortedItems.map((item) => {
              const isBlocked: boolean = blocklist.isBlocked({ publicKeyHex: item.peerPublicKeyHex });
              const isMuted: boolean = peerTrust.isMuted({ publicKeyHex: item.peerPublicKeyHex });
              const isRevealed: boolean = revealedByPubkey[item.peerPublicKeyHex] ?? false;
              return (
                <Card
                  key={item.peerPublicKeyHex}
                  title={item.peerPublicKeyHex.slice(0, 16)}
                  description="Unknown sender"
                  className="w-full"
                >
                  <div className="space-y-2">
                    <div className="font-mono text-xs wrap-break-word text-zinc-700 dark:text-zinc-300">{item.peerPublicKeyHex}</div>
                    <div className={cn("text-sm", isBlocked ? "text-zinc-400 line-through dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-200")}>
                      {isRevealed ? item.lastMessagePreview : "Preview hidden"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isBlocked}
                        onClick={() => {
                          setRevealedByPubkey((prev: Readonly<Record<string, boolean>>): Readonly<Record<string, boolean>> => ({
                            ...prev,
                            [item.peerPublicKeyHex]: !isRevealed,
                          }));
                        }}
                      >
                        {isRevealed ? "Hide" : "Reveal"}
                      </Button>
                      <Button
                        type="button"
                        disabled={isBlocked}
                        onClick={() => {
                          peerTrust.acceptPeer({ publicKeyHex: item.peerPublicKeyHex });
                          requestsInbox.remove({ peerPublicKeyHex: item.peerPublicKeyHex });
                          const encoded: string = encodeURIComponent(item.peerPublicKeyHex);
                          router.push(`/?pubkey=${encoded}`);
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={isBlocked}
                        onClick={() => {
                          if (isMuted) {
                            peerTrust.unmutePeer({ publicKeyHex: item.peerPublicKeyHex });
                            return;
                          }
                          peerTrust.mutePeer({ publicKeyHex: item.peerPublicKeyHex });
                          requestsInbox.remove({ peerPublicKeyHex: item.peerPublicKeyHex });
                        }}
                      >
                        {isMuted ? "Unmute" : "Mute"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          blocklist.addBlocked({ publicKeyInput: item.peerPublicKeyHex });
                          peerTrust.unacceptPeer({ publicKeyHex: item.peerPublicKeyHex });
                          peerTrust.unmutePeer({ publicKeyHex: item.peerPublicKeyHex });
                          requestsInbox.remove({ peerPublicKeyHex: item.peerPublicKeyHex });
                        }}
                      >
                        {isBlocked ? "Blocked" : "Block"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                          requestsInbox.markRead({ peerPublicKeyHex: item.peerPublicKeyHex });
                        }}
                      >
                        Mark read
                      </Button>
                    </div>
                    {item.unreadCount > 0 ? (
                      <div className="text-xs text-zinc-600 dark:text-zinc-400">Unread: {item.unreadCount}</div>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}
