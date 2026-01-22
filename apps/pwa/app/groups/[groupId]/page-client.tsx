"use client";

import type React from "react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "../../components/page-shell";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Textarea } from "../../components/ui/textarea";
import { IdentityCard } from "../../components/identity-card";
import { useRelayPool } from "../../lib/use-relay-pool";
import { parseNip29GroupIdentifier } from "../../lib/parse-nip29-group-identifier";
import { useNip29Group } from "../../lib/use-nip29-group";
import { useIdentity } from "../../lib/use-identity";
import useNavBadges from "../../lib/use-nav-badges";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type GroupPageClientProps = Readonly<{
    groupId: string;
}>;

export default function GroupPageClient(props: GroupPageClientProps): React.JSX.Element {
    const router = useRouter();
    const parsed = useMemo(() => parseNip29GroupIdentifier(props.groupId), [props.groupId]);
    const relayUrl: string = parsed.ok ? parsed.relayUrl : "";
    const groupId: string = parsed.ok ? parsed.groupId : "";
    const pool = useRelayPool(relayUrl ? [relayUrl] : []);
    const identity = useIdentity();
    const navBadges = useNavBadges({ publicKeyHex: (identity.state.publicKeyHex as PublicKeyHex | null) ?? null });
    const myPublicKeyHex: PublicKeyHex | null = identity.state.status === "unlocked" ? identity.state.publicKeyHex ?? null : null;
    const myPrivateKeyHex: PrivateKeyHex | null = identity.state.status === "unlocked" ? identity.state.privateKeyHex ?? null : null;
    const group = useNip29Group({ pool, relayUrl, groupId, myPublicKeyHex, myPrivateKeyHex });
    const [outgoingMessage, setOutgoingMessage] = useState<string>("");

    const handleCopyInviteLink = (params: Readonly<{ relayUrl: string; groupId: string; inviterPublicKeyHex?: string; name?: string }>): void => {
        const nextUrl: URL = new URL("/invite", window.location.origin);
        nextUrl.searchParams.set("relay", params.relayUrl);
        nextUrl.searchParams.set("group", params.groupId);
        if (params.inviterPublicKeyHex) {
            nextUrl.searchParams.set("inviter", params.inviterPublicKeyHex);
        }
        if (params.name) {
            nextUrl.searchParams.set("name", params.name);
        }
        void navigator.clipboard.writeText(nextUrl.toString());
    };

    if (!parsed.ok) {
        return (
            <PageShell title="Group" navBadgeCounts={navBadges.navBadgeCounts}>
                <div className="mx-auto w-full max-w-3xl p-4">
                    <Card title="Invalid group" description={parsed.error} className="w-full" tone="danger">
                        <div className="text-sm text-zinc-700 dark:text-zinc-300">Expected format: <span className="font-mono">host{"'"}group-id</span></div>
                    </Card>
                </div>
            </PageShell>
        );
    }

    const title: string = group.state.metadata?.name ?? parsed.identifier;
    const isIdentityUnlocked: boolean = identity.state.status === "unlocked";
    const isMember: boolean = group.state.membership.status === "member";
    const canRequestJoin: boolean = isIdentityUnlocked && !isMember;
    const canSend: boolean = isIdentityUnlocked && outgoingMessage.trim().length > 0 && (!group.state.metadata?.isRestricted || isMember);

    return (
        <PageShell title={title} navBadgeCounts={navBadges.navBadgeCounts}>
            <div className="mx-auto w-full max-w-4xl p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="mt-1 font-mono text-xs wrap-break-word text-zinc-600 dark:text-zinc-400">h={groupId}</div>
                        <div className="mt-1 font-mono text-xs wrap-break-word text-zinc-600 dark:text-zinc-400">{parsed.relayUrl}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2 sm:flex-row">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                handleCopyInviteLink({
                                    relayUrl: parsed.relayUrl,
                                    groupId: parsed.groupId,
                                    inviterPublicKeyHex: myPublicKeyHex ?? undefined,
                                    name: title,
                                });
                            }}
                        >
                            Copy invite link
                        </Button>
                        <Button type="button" variant="secondary" onClick={group.refresh}>
                            Refresh
                        </Button>
                        <Button
                            type="button"
                            disabled={!canRequestJoin}
                            onClick={() => {
                                void group.requestJoin();
                            }}
                        >
                            {isMember ? "Member" : "Join"}
                        </Button>
                    </div>
                </div>

                {!isIdentityUnlocked ? (
                    <div className="mb-4">
                        <Card title="Identity locked" description="Unlock your identity to join and post." className="w-full">
                            <div className="space-y-2">
                                <div className="flex flex-wrap gap-2">
                                    <Button type="button" onClick={() => router.push("/settings")}>
                                        Open Settings
                                    </Button>
                                    <Button type="button" variant="secondary" onClick={group.refresh}>
                                        Refresh
                                    </Button>
                                </div>
                                <IdentityCard />
                            </div>
                        </Card>
                    </div>
                ) : null}

                {group.state.relayFeedback.lastOk ? (
                    <div className={group.state.relayFeedback.lastOk.accepted ? "mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-200" : "mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-800 dark:text-red-200"}>
                        OK({group.state.relayFeedback.lastOk.accepted ? "accepted" : "rejected"}): {group.state.relayFeedback.lastOk.message}
                    </div>
                ) : null}

                {group.state.relayFeedback.lastNotice ? (
                    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
                        NOTICE: {group.state.relayFeedback.lastNotice}
                    </div>
                ) : null}

                {group.state.error ? (
                    <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-800 dark:text-red-200">{group.state.error}</div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card title="Metadata" description="From relay-signed kind:39000" className="md:col-span-1">
                        {group.state.metadata ? (
                            <div className="space-y-2">
                                {group.state.metadata.picture ? (
                                    <div className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
                                        <Image src={group.state.metadata.picture} alt="Group picture" width={512} height={512} unoptimized className="h-40 w-full object-cover" />
                                    </div>
                                ) : null}
                                {group.state.metadata.about ? <div className="text-sm wrap-break-word">{group.state.metadata.about}</div> : <div className="text-sm text-zinc-600 dark:text-zinc-400">No about field.</div>}
                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                    Private: <span className="font-medium text-zinc-900 dark:text-zinc-100">{group.state.metadata.isPrivate ? "yes" : "no"}</span>
                                </div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                    Restricted: <span className="font-medium text-zinc-900 dark:text-zinc-100">{group.state.metadata.isRestricted ? "yes" : "no"}</span>
                                </div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                    Hidden: <span className="font-medium text-zinc-900 dark:text-zinc-100">{group.state.metadata.isHidden ? "yes" : "no"}</span>
                                </div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                    Closed: <span className="font-medium text-zinc-900 dark:text-zinc-100">{group.state.metadata.isClosed ? "yes" : "no"}</span>
                                </div>
                                <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                    Membership: <span className="font-medium text-zinc-900 dark:text-zinc-100">{group.state.membership.status}</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-zinc-600 dark:text-zinc-400">No metadata yet (could be unmanaged).</div>
                        )}
                    </Card>

                    <Card title="Timeline" description="Recent kind:1 events tagged with h" className="md:col-span-2">
                        {group.state.status === "loading" ? <div className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</div> : null}
                        <div className="mt-3">
                            <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Post a message</div>
                            <div className="mt-2 space-y-2">
                                <Textarea
                                    value={outgoingMessage}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setOutgoingMessage(e.target.value)}
                                    placeholder={isIdentityUnlocked ? (group.state.metadata?.isRestricted && !isMember ? "Join the group to post." : "Write a message…") : "Unlock your identity to post."}
                                    rows={3}
                                />
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                                        {group.state.metadata?.isRestricted ? (isMember ? "Restricted: you can post." : "Restricted: members-only posting.") : "Public posting."}
                                    </div>
                                    <Button
                                        type="button"
                                        disabled={!canSend}
                                        onClick={() => {
                                            const content: string = outgoingMessage;
                                            setOutgoingMessage("");
                                            void group.sendMessage({ content });
                                        }}
                                    >
                                        Send
                                    </Button>
                                </div>
                            </div>
                        </div>
                        {group.state.messages.length === 0 ? <div className="text-sm text-zinc-600 dark:text-zinc-400">No messages yet.</div> : null}
                        <ul className="mt-2 space-y-2">
                            {group.state.messages.slice(0, 30).map((event) => (
                                <li key={event.id} className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/60">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 font-mono text-[11px] text-zinc-600 wrap-break-word dark:text-zinc-400">{event.pubkey}</div>
                                        <div className="shrink-0 font-mono text-[11px] text-zinc-500 dark:text-zinc-500">{new Date(event.created_at * 1000).toISOString()}</div>
                                    </div>
                                    <div className="mt-2 text-sm wrap-break-word whitespace-pre-wrap">{event.content}</div>
                                </li>
                            ))}
                        </ul>
                    </Card>
                </div>
            </div>
        </PageShell>
    );
}
