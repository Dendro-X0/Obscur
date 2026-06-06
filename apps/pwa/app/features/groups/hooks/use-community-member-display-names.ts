"use client";

import { useEffect, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { EnhancedRelayPoolResult } from "@/app/features/relays/hooks/enhanced-relay-pool";

/**
 * Path B B2: ephemeral kind-0 profile REQ scoped to dialog/surface lifecycle.
 * Does not compete with `use-sealed-community` timeline subscription — names only.
 */
export const useCommunityMemberDisplayNames = (params: Readonly<{
  enabled: boolean;
  memberPubkeys: ReadonlyArray<PublicKeyHex>;
  pool: Pick<EnhancedRelayPoolResult, "subscribeToMessages" | "sendToOpen"> | null;
}>): Readonly<Record<string, string>> => {
  const [resolvedNames, setResolvedNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const relayPool = params.pool;
    const activeMemberList = params.memberPubkeys;
    if (!params.enabled || !relayPool || activeMemberList.length === 0) {
      return;
    }

    const subId = `mgmt-names-${Math.random().toString(36).substring(7)}`;
    const filter = { kinds: [0], authors: activeMemberList as string[] };

    const cleanup = relayPool.subscribeToMessages(({ message }: { message: string }) => {
      try {
        const parsed = JSON.parse(message) as unknown;
        if (!Array.isArray(parsed) || parsed[0] !== "EVENT" || parsed[1] !== subId) {
          return;
        }
        const event = parsed[2] as { kind?: number; pubkey?: string; content?: string };
        if (event.kind !== 0 || !event.pubkey) {
          return;
        }
        try {
          const metadata = JSON.parse(event.content ?? "{}") as Record<string, unknown>;
          const name = (typeof metadata.display_name === "string" && metadata.display_name)
            || (typeof metadata.name === "string" && metadata.name)
            || "";
          if (name) {
            setResolvedNames((prev) => ({ ...prev, [event.pubkey!]: name }));
          }
        } catch {
          // ignore bad metadata
        }
      } catch {
        // ignore parse errors
      }
    });

    relayPool.sendToOpen(JSON.stringify(["REQ", subId, filter]));
    return () => {
      try {
        relayPool.sendToOpen(JSON.stringify(["CLOSE", subId]));
        cleanup();
      } catch {
        // ignore close errors
      }
    };
  }, [params.enabled, params.memberPubkeys, params.pool]);

  return resolvedNames;
};
