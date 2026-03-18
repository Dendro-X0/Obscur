"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelayList } from "@/app/features/relays/hooks/use-relay-list";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useGroups } from "@/app/features/groups/providers/group-provider";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { toDmConversationId } from "@/app/features/messaging/utils/dm-conversation-id";
import { createDmConversation } from "@/app/features/messaging/utils/create-dm-conversation";
import { resolveConversationByToken } from "@/app/features/messaging/utils/conversation-target";
import { listenToNativeEvent } from "@/app/features/runtime/native-event-adapter";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import {
    resolveDiscoveryQueryFromDeepLinkUrl,
    resolveDiscoveryQueryFromSearchParams,
} from "@/app/features/search/services/discovery-deep-link";

const decodeRouteValue = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return "";
    try {
        return decodeURIComponent(trimmed);
    } catch {
        return trimmed;
    }
};

export function useDeepLinks(handleRedeemInvite: (token: string) => Promise<void>) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const identity = useIdentity();
    const relayList = useRelayList({ publicKeyHex: identity.state.publicKeyHex ?? null });
    const { setNewChatPubkey, setNewChatDisplayName, setIsNewChatOpen, createdConnections, setSelectedConversation, unhideConversation } = useMessaging();
    const { createdGroups } = useGroups();
    const handledSearchParamRef = useRef<string | null>(null);

    // Deep Link Listener for Mobile/Desktop (Tauri)
    useEffect(() => {
        if (typeof window === "undefined") return;

        let unlisten: (() => void) | undefined;

        void listenToNativeEvent<{ url: string }>("deep-link", (event) => {
                    const urlStr = event.payload?.url;
                    if (!urlStr) return;

                    try {
                        const discoveryFlags = PrivacySettingsService.getDiscoveryFeatureFlags();
                        if (discoveryFlags.deepLinkV1) {
                            const discoveryQuery = resolveDiscoveryQueryFromDeepLinkUrl(urlStr);
                            if (discoveryQuery) {
                                queueMicrotask(() => {
                                    router.replace(`/search?q=${encodeURIComponent(discoveryQuery)}`);
                                });
                                return;
                            }
                        }

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
                                    const cid = toDmConversationId({ myPublicKeyHex: myPk, peerPublicKeyHex: parsed.publicKeyHex });
                                    if (!cid) return;
                                    const existingConnection = createdConnections.find(c => c.id === cid);
                                    if (existingConnection) {
                                        setSelectedConversation(existingConnection);
                                        unhideConversation(cid);
                                    } else {
                                        const newConv = createDmConversation({
                                            myPublicKeyHex: myPk,
                                            peerPublicKeyHex: parsed.publicKeyHex,
                                        });
                                        if (!newConv) return;
                                        setSelectedConversation(newConv);
                                    }
                                    router.replace("/");
                                });
                            }
                        }
                    } catch (e) {
                        console.error("Failed to parse deep link URL:", e);
                    }
                }).then((nextUnlisten) => {
                    unlisten = nextUnlisten;
                });

        return () => {
            if (unlisten) unlisten();
        };
    }, [createdConnections, handleRedeemInvite, identity.state.publicKeyHex, router, setNewChatPubkey, setNewChatDisplayName, setIsNewChatOpen, setSelectedConversation, unhideConversation]);

    // Query Param Listener (Web)
    useEffect(() => {
        const pubkey = (searchParams.get("chat") || searchParams.get("pubkey") || "").trim();
        const relays = (searchParams.get("relays") || "").trim();
        const inviteToken = (searchParams.get("inviteToken") || "").trim();
        const convId = decodeRouteValue(searchParams.get("convId") || "");
        const discoveryFlags = PrivacySettingsService.getDiscoveryFeatureFlags();
        const discoveryQuery = discoveryFlags.deepLinkV1
            ? resolveDiscoveryQueryFromSearchParams(searchParams)
            : null;

        if (!pubkey && !relays && !inviteToken && !convId && !discoveryQuery) return;

        const myPk = identity.state.publicKeyHex || "";
        const cacheKey = `${pubkey}:${relays}:${inviteToken}:${convId}:${myPk}:${discoveryQuery || ""}`;
        if (handledSearchParamRef.current === cacheKey) return;
        let handled = false;

        if (discoveryQuery) {
            queueMicrotask(() => {
                router.replace(`/search?q=${encodeURIComponent(discoveryQuery)}`);
            });
            handled = true;
            handledSearchParamRef.current = cacheKey;
            return;
        }

        if (inviteToken) void handleRedeemInvite(inviteToken);

        if (relays) {
            const relayUrls = relays.split(",").map(r => r.trim()).filter(Boolean);
            relayUrls.forEach(url => relayList.addRelay({ url }));
        }

        if (pubkey) {
            const parsed = parsePublicKeyInput(pubkey);
            if (parsed.ok) {
                queueMicrotask(() => {
                    const cid = toDmConversationId({ myPublicKeyHex: myPk, peerPublicKeyHex: parsed.publicKeyHex });
                    if (!cid) return;
                    const existingConnection = createdConnections.find(c => c.id === cid);
                    if (existingConnection) {
                        setSelectedConversation(existingConnection);
                        unhideConversation(cid);
                    } else {
                        const newConv = createDmConversation({
                            myPublicKeyHex: myPk,
                            peerPublicKeyHex: parsed.publicKeyHex,
                        });
                        if (!newConv) return;
                        setSelectedConversation(newConv);
                    }
                    router.replace("/");
                });
                handled = true;
            }
        }

        if (convId) {
            const resolved = resolveConversationByToken({
                token: convId,
                groups: createdGroups,
                connections: createdConnections,
            });
            if (resolved) {
                setSelectedConversation(resolved);
                if (resolved.kind === "dm") {
                    unhideConversation(resolved.id);
                }
                router.replace("/");
                handled = true;
            }
        }
        if (handled) {
            handledSearchParamRef.current = cacheKey;
        }
    }, [searchParams, relayList, identity.state.publicKeyHex, handleRedeemInvite, router, setNewChatPubkey, setNewChatDisplayName, setIsNewChatOpen, createdGroups, createdConnections, setSelectedConversation, unhideConversation]);
}
