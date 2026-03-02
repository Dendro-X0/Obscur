"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";

export function useDeepLinks(handleRedeemInvite: (token: string) => Promise<void>) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const identity = useIdentity();
    const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex ?? null });
    const { setNewChatPubkey, setNewChatDisplayName, setIsNewChatOpen, createdConnections, setCreatedConnections, setSelectedConversation, unhideConversation } = useMessaging();
    const { createdGroups } = useGroups();
    const handledSearchParamRef = useRef<string | null>(null);

    // Deep Link Listener for Mobile/Desktop (Tauri)
    useEffect(() => {
        if (typeof window === "undefined") return;

        let unlisten: (() => void) | undefined;

        void (async () => {
            try {
                const { listen } = await import("@tauri-apps/api/event");
                unlisten = await listen<{ url: string }>("deep-link", (event) => {
                    const urlStr = event.payload.url;
                    if (!urlStr) return;

                    try {
                        const url = new URL(urlStr);
                        // Case 1: obscur://invite/TOKEN
                        if (url.protocol === "obscur:" && url.host === "invite") {
                            const token = url.pathname.replace(/^\//, "");
                            if (token) void handleRedeemInvite(token);
                        }
                        // Case 2: Query param in deep link
                        const token = url.searchParams.get("inviteToken") || url.searchParams.get("invite");
                        if (token) void handleRedeemInvite(token);

                        // Handle pubkey/npub
                        const pubkey = url.searchParams.get("pubkey") || url.searchParams.get("chat");
                        if (pubkey) {
                            const parsed = parsePublicKeyInput(pubkey);
                            if (parsed.ok) {
                                queueMicrotask(() => {
                                    const myPk = identity.state.publicKeyHex || "";
                                    const cid = [myPk, parsed.publicKeyHex].sort().join(':');
                                    const existingConnection = createdConnections.find(c => c.id === cid);
                                    if (existingConnection) {
                                        setSelectedConversation(existingConnection);
                                        unhideConversation(cid);
                                    } else {
                                        const newConv: any = {
                                            kind: 'dm',
                                            id: cid,
                                            pubkey: parsed.publicKeyHex,
                                            displayName: parsed.publicKeyHex.slice(0, 8),
                                            lastMessage: '',
                                            unreadCount: 0,
                                            lastMessageTime: new Date()
                                        };
                                        setCreatedConnections((prev: any) => [...prev, newConv]);
                                        setSelectedConversation(newConv);
                                    }
                                    router.replace("/");
                                });
                            }
                        }
                    } catch (e) {
                        console.error("Failed to parse deep link URL:", e);
                    }
                });
            } catch (e) {
                // Not in Tauri
            }
        })();

        return () => {
            if (unlisten) unlisten();
        };
    }, [handleRedeemInvite, setNewChatPubkey, setNewChatDisplayName, setIsNewChatOpen]);

    // Query Param Listener (Web)
    useEffect(() => {
        const pubkey = (searchParams.get("chat") || searchParams.get("pubkey") || "").trim();
        const relays = (searchParams.get("relays") || "").trim();
        const inviteToken = (searchParams.get("inviteToken") || "").trim();
        const convId = (searchParams.get("convId") || "").trim();

        if (!pubkey && !relays && !inviteToken && !convId) return;

        const myPk = identity.state.publicKeyHex || "";
        const cacheKey = `${pubkey}:${relays}:${inviteToken}:${convId}:${myPk}`;
        if (handledSearchParamRef.current === cacheKey) return;
        handledSearchParamRef.current = cacheKey;

        if (inviteToken) void handleRedeemInvite(inviteToken);

        if (relays) {
            const relayUrls = relays.split(",").map(r => r.trim()).filter(Boolean);
            relayUrls.forEach(url => relayList.addRelay({ url }));
        }

        if (pubkey) {
            const parsed = parsePublicKeyInput(pubkey);
            if (parsed.ok) {
                queueMicrotask(() => {
                    const cid = [myPk, parsed.publicKeyHex].sort().join(':');
                    const existingConnection = createdConnections.find(c => c.id === cid);
                    if (existingConnection) {
                        setSelectedConversation(existingConnection);
                        unhideConversation(cid);
                    } else {
                        const newConv: any = {
                            kind: 'dm',
                            id: cid,
                            pubkey: parsed.publicKeyHex,
                            displayName: parsed.publicKeyHex.slice(0, 8),
                            lastMessage: '',
                            unreadCount: 0,
                            lastMessageTime: new Date()
                        };
                        setCreatedConnections((prev: any) => [...prev, newConv]);
                        setSelectedConversation(newConv);
                    }
                    router.replace("/");
                });
            }
        }

        if (convId) {
            const group = createdGroups.find(g => g.id === convId);
            if (group) {
                setSelectedConversation(group);
                router.replace("/");
            } else {
                const connection = createdConnections.find(c => c.id === convId);
                if (connection) {
                    setSelectedConversation(connection);
                    router.replace("/");
                }
            }
        }
    }, [searchParams, relayList, identity.state.publicKeyHex, handleRedeemInvite, router, setNewChatPubkey, setNewChatDisplayName, setIsNewChatOpen, createdGroups, createdConnections, setSelectedConversation]);
}
