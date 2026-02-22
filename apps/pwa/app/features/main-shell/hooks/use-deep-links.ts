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
    const { setNewChatPubkey, setNewChatDisplayName, setIsNewChatOpen, createdContacts, setSelectedConversation } = useMessaging();
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
                                    setNewChatPubkey(parsed.publicKeyHex);
                                    setNewChatDisplayName("");
                                    setIsNewChatOpen(true);
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
                    setNewChatPubkey(parsed.publicKeyHex);
                    setNewChatDisplayName("");
                    setIsNewChatOpen(true);
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
                const contact = createdContacts.find(c => c.id === convId);
                if (contact) {
                    setSelectedConversation(contact);
                    router.replace("/");
                }
            }
        }
    }, [searchParams, relayList, identity.state.publicKeyHex, handleRedeemInvite, router, setNewChatPubkey, setNewChatDisplayName, setIsNewChatOpen, createdGroups, createdContacts, setSelectedConversation]);
}
