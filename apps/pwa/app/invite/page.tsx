"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageShell } from "../components/page-shell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { IdentityCard } from "../components/identity-card";
import { useIdentity } from "../lib/use-identity";
import { parseInviteParams } from "../lib/parse-invite-params";
import { useInvites } from "../lib/use-invites";
import useNavBadges from "../lib/use-nav-badges";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type InviteDraft = Readonly<{
  id: string;
  relayUrl: string;
  groupId: string;
  host: string;
  identifier: string;
  inviterPublicKeyHex?: string;
  label?: string;
}>;

const createInviteId = (params: Readonly<{ host: string; groupId: string; inviterPublicKeyHex?: string }>): string => {
  const inviter: string = params.inviterPublicKeyHex ? params.inviterPublicKeyHex.slice(0, 16) : "_";
  return `${params.host}:${params.groupId}:${inviter}`;
};

export default function InvitePage(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const identity = useIdentity();
  const publicKeyHex: string | null = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
  const navBadges = useNavBadges({ publicKeyHex: (publicKeyHex as PublicKeyHex | null) ?? null });
  const invites = useInvites({ publicKeyHex });
  const parsed = useMemo(() => parseInviteParams(searchParams), [searchParams]);
  const [didSave, setDidSave] = useState<boolean>(false);
  const canSave: boolean = Boolean(publicKeyHex) && parsed.ok;
  const canOpen: boolean = parsed.ok;
  const invite: InviteDraft | null = useMemo((): InviteDraft | null => {
    if (!parsed.ok) {
      return null;
    }
    const id: string = createInviteId({ host: parsed.host, groupId: parsed.groupId, inviterPublicKeyHex: parsed.inviterPublicKeyHex });
    return {
      id,
      relayUrl: parsed.relayUrl,
      groupId: parsed.groupId,
      host: parsed.host,
      identifier: parsed.identifier,
      inviterPublicKeyHex: parsed.inviterPublicKeyHex,
      label: parsed.label,
    };
  }, [parsed]);

  return (
    <PageShell title="Invite" navBadgeCounts={navBadges.navBadgeCounts}>
      <div className="mx-auto w-full max-w-3xl p-4">
        {!parsed.ok ? (
          <Card title="Invalid invite" description={parsed.error} className="w-full" tone="danger">
            <div className="text-sm text-zinc-700 dark:text-zinc-300">Expected query params: <span className="font-mono">relay</span>, <span className="font-mono">group</span> (optional: <span className="font-mono">inviter</span>, <span className="font-mono">name</span>).</div>
          </Card>
        ) : (
          <Card title={parsed.label ?? parsed.groupId} description="This invite is a pointer (not a credential)." className="w-full">
            <div className="space-y-3">
              <div className="rounded-xl border border-black/10 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-200">
                <div className="font-medium">Group</div>
                <div className="mt-1 font-mono wrap-break-word">{parsed.identifier}</div>
                <div className="mt-3 font-medium">Relay</div>
                <div className="mt-1 font-mono wrap-break-word">{parsed.relayUrl}</div>
                {parsed.inviterPublicKeyHex ? (
                  <>
                    <div className="mt-3 font-medium">Inviter</div>
                    <div className="mt-1 font-mono wrap-break-word">{parsed.inviterPublicKeyHex}</div>
                  </>
                ) : null}
              </div>

              {!publicKeyHex ? (
                <div className="space-y-2">
                  <div className="text-sm text-zinc-700 dark:text-zinc-300">Create an identity (Settings) to save invites under a persona.</div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => router.push("/settings")}>
                      Open Settings
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => router.push("/invites")}>
                      View invites
                    </Button>
                  </div>
                  <div className="pt-2">
                    <IdentityCard />
                  </div>
                </div>
              ) : null}

              {didSave ? <div className="text-sm text-emerald-700 dark:text-emerald-300">Saved to your Invites.</div> : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!canSave || !invite}
                  onClick={() => {
                    if (!invite) {
                      return;
                    }
                    invites.saveInvite({ ...invite, createdAtUnixMs: Date.now() });
                    setDidSave(true);
                  }}
                >
                  Save invite
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canOpen}
                  onClick={() => {
                    if (!parsed.ok) {
                      return;
                    }
                    router.push(`/groups/${encodeURIComponent(parsed.identifier)}`);
                  }}
                >
                  Open group
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    router.push("/invites");
                  }}
                >
                  View invites
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
