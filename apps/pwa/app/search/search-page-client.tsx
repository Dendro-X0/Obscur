"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { nip19 } from "nostr-tools";
import { AlertTriangle, X, Copy, History, QrCode, Search as SearchIcon, SearchX, UserPlus, WifiOff } from "lucide-react";
import QRCode from "qrcode";
import { Avatar, AvatarFallback, AvatarImage, Button, Input, cn, toast } from "@dweb/ui-kit";
import { PageShell } from "@/app/components/page-shell";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import { useNetwork } from "@/app/features/network/providers/network-provider";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useProfile } from "@/app/features/profile/hooks/use-profile";
import { useResolvedProfileMetadata } from "@/app/features/profile/hooks/use-resolved-profile-metadata";
import { ProfileCompletenessIndicator } from "@/app/features/profile/components/profile-completeness-indicator";
import { useGlobalSearch } from "@/app/features/search/hooks/use-global-search";
import { useMobileCompactLayout } from "@/app/features/runtime/use-mobile-compact-layout";
import { useIdentityResolver } from "@/app/features/search/hooks/use-identity-resolver";
import { getPublicGroupHref, getPublicProfileHref } from "@/app/features/navigation/public-routes";
import { useContactRequestOutbox } from "@/app/features/search/hooks/use-contact-request-outbox";
import { useInviteResolver } from "@/app/features/invites/utils/use-invite-resolver";
import { isValidInviteCode } from "@/app/features/invites/utils/invite-parser";
import { SearchResultCard } from "@/app/features/search/components/search-result-card";
import { discoveryCache } from "@/app/features/search/services/discovery-cache";
import { buildFriendSuggestions } from "@/app/features/search/services/friend-suggestions";
import { discoverySessionDiagnosticsStore } from "@/app/features/search/services/discovery-session-diagnostics";
import { useRequestTransport } from "@/app/features/messaging/hooks/use-request-transport";
import { buildContactCardDeepLink, createSignedContactCard, encodeContactCard, extractContactCardFromQuery } from "@/app/features/search/services/contact-card";
import { isDeterministicDirectQuery } from "./search-page-helpers";
import { encodeFriendCodeV2 } from "@/app/features/search/services/friend-code-v2";
import { encodeFriendCodeV3 } from "@/app/features/search/services/friend-code-v3";
import type { ContactRequestRecord, DeliveryStatusToastPayload, DiscoveryIntent, DiscoveryResult, PublicDiscoveryProfile, ResolveResult, ResolvedIdentity } from "@/app/features/search/types/discovery";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { useEnhancedDMController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import { InvitationComposerDialog } from "@/app/features/messaging/components/invitation-composer-dialog";
import { buildInvitationRequestMessage, DEFAULT_INVITATION_INTRO, type InvitationComposerValues, } from "@/app/features/messaging/services/invitation-composer";
import { getDirectInvitationStatusCopy, getDirectInvitationToastCopy, getInvitationOutboxStatusCopy, type InvitationTone, } from "@/app/features/messaging/services/invitation-presentation";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { getV090RolloutPolicy } from "@/app/features/settings/services/v090-rollout-policy";
import { normalizePublicUrl } from "@/app/shared/public-url";
import { scheduleIdleWork } from "@/app/shared/schedule-idle-work";
import { DISCOVERY_EXACT_MATCH_ELEMENT_ID, discoverySearchResultElementId, discoverySuggestionElementId, focusSearchTargetById, } from "@/app/shared/search-target-highlight";
import type { RelayReadinessState } from "@/app/features/relays/services/relay-recovery-types";
type DiscoverySurface = "global" | "add_friend" | "communities";
type DirectRequestPhase = "idle" | "sending" | "ok" | "partial" | "queued" | "failed" | "unsupported";
const getRecentSearchesStorageKey = (): string => getScopedStorageKey("recent_searches", getResolvedProfileId());
const LEGACY_RECENT_SEARCHES_STORAGE_KEY = "recent_searches";
const REQUEST_SEND_TIMEOUT_MS = 15000;
const mapSurfaceToIntent = (surface: DiscoverySurface): DiscoveryIntent => {
    if (surface === "global")
        return "search_people";
    if (surface === "communities")
        return "search_communities";
    return "add_friend";
};
const invitationToneClassName = (tone: InvitationTone): string => {
    if (tone === "success")
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    if (tone === "warning")
        return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    if (tone === "danger")
        return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    if (tone === "info")
        return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    return "border-border/60 bg-muted/30 text-muted-foreground";
};
const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
            }),
        ]);
    }
    finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
};
const resolveStableIdentity = (input: string, messages: Readonly<{
    invalidInput: string;
    unsupportedToken: string;
}>): ResolveResult => {
    const trimmed = input.trim();
    if (!trimmed) {
        return { ok: false, reason: "invalid_input", message: messages.invalidInput };
    }
    const contactCard = extractContactCardFromQuery(trimmed);
    if (contactCard) {
        return {
            ok: true,
            identity: {
                pubkey: contactCard.pubkey,
                display: contactCard.label,
                relays: contactCard.relays,
                inviteCode: contactCard.inviteCode,
                source: "contact_card",
                confidence: "direct",
            },
        };
    }
    const parsedPubkey = parsePublicKeyInput(trimmed);
    if (parsedPubkey.ok) {
        return {
            ok: true,
            identity: {
                pubkey: parsedPubkey.publicKeyHex,
                relays: parsedPubkey.relays,
                source: parsedPubkey.format === "npub" ? "npub" : "hex",
                confidence: "direct",
            },
        };
    }
    return {
        ok: false,
        reason: "unsupported_token",
        message: messages.unsupportedToken,
    };
};
const mapToPublicDiscoveryProfile = (result: DiscoveryResult): PublicDiscoveryProfile | null => {
    if (result.kind !== "person" && result.kind !== "community" && result.kind !== "invite" && result.kind !== "contact_card") {
        return null;
    }
    if (result.kind === "community") {
        return {
            id: result.canonicalId,
            kind: "community",
            title: result.display.title,
            subtitle: result.display.subtitle,
            description: result.display.description,
            picture: result.display.picture,
            communityId: result.display.communityId,
            relayUrl: result.display.relayUrl,
            confidence: result.confidence,
            sources: result.sources,
        };
    }
    let npub: string | undefined;
    if (result.display.pubkey) {
        try {
            npub = nip19.npubEncode(result.display.pubkey as PublicKeyHex);
        }
        catch {
            npub = undefined;
        }
    }
    return {
        id: result.canonicalId,
        kind: "person",
        title: result.display.title,
        subtitle: result.display.subtitle,
        description: result.display.description,
        picture: result.display.picture,
        pubkey: result.display.pubkey,
        npub,
        confidence: result.confidence,
        sources: result.sources,
    };
};
const mapResolvedIdentityToPublicDiscoveryProfile = (identity: ResolvedIdentity): PublicDiscoveryProfile => {
    let npub: string | undefined;
    try {
        npub = nip19.npubEncode(identity.pubkey as PublicKeyHex);
    }
    catch {
        npub = undefined;
    }
    return {
        id: `resolved:${identity.pubkey}`,
        kind: "person",
        title: identity.display || "",
        subtitle: identity.source.replace("_", " "),
        pubkey: identity.pubkey,
        npub,
        confidence: identity.confidence,
        sources: ["local"],
    };
};
const getProfileInitials = (input: string | null | undefined): string => {
    const normalized = (input || "").trim();
    if (!normalized)
        return "??";
    const segments = normalized.split(/\s+/).filter(Boolean);
    if (segments.length >= 2) {
        return `${segments[0][0] || ""}${segments[1][0] || ""}`.toUpperCase();
    }
    return normalized.slice(0, 2).toUpperCase();
};
const compactKey = (value: string | undefined, leading = 16, trailing = 12): string => {
    if (!value)
        return "";
    if (value.length <= leading + trailing + 3)
        return value;
    return `${value.slice(0, leading)}...${value.slice(-trailing)}`;
};
const isLikelyNip05Identifier = (value: string | undefined): boolean => {
    if (!value)
        return false;
    const trimmed = value.trim();
    if (!trimmed)
        return false;
    return /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed);
};
const emitDeliveryToast = (payload: DeliveryStatusToastPayload): void => {
    if (payload.status === "sent_quorum") {
        toast.success(payload.message);
        return;
    }
    if (payload.status === "sent_partial" || payload.status === "queued_retrying") {
        toast.warning(payload.message);
        return;
    }
    toast.error(payload.message);
};
export default function SearchPage() {
    const { t } = useTranslation();
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialQuery = searchParams.get("q") || "";
    const { identity, blocklist, peerTrust, requestsInbox } = useNetwork();
    const { enabledRelayUrls, relayPool, relayRecovery } = useRelay();
    const profile = useProfile();
    const publicKeyHex = (identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null) as PublicKeyHex | null;
    const privateKeyHex = (identity.state.privateKeyHex ?? null) as PrivateKeyHex | null;
    const navBadges = useNavBadges({ publicKeyHex });
    const isMobileDiscoveryCompact = useMobileCompactLayout();
    const [privacySettings, setPrivacySettings] = useState(() => PrivacySettingsService.getSettings());
    const rolloutPolicy = useMemo(() => getV090RolloutPolicy(privacySettings), [privacySettings]);
    const discoveryFeatureFlags = useMemo(() => PrivacySettingsService.getDiscoveryFeatureFlags(privacySettings), [privacySettings]);
    const allowLegacyInviteCode = discoveryFeatureFlags.inviteCodeV1;
    const stabilityModeEnabled = rolloutPolicy.stabilityModeEnabled;
    const deterministicDiscoveryEnabled = rolloutPolicy.deterministicDiscoveryEnabled;
    const [surface, setSurface] = useState<DiscoverySurface>("global");
    const [query, setQuery] = useState(initialQuery);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [shareCardEncoded, setShareCardEncoded] = useState<string>("");
    const [shareLink, setShareLink] = useState<string>("");
    const [shareQrDataUrl, setShareQrDataUrl] = useState<string>("");
    const [friendCodeV2, setFriendCodeV2] = useState<string>("");
    const [friendCodeV3, setFriendCodeV3] = useState<string>("");
    const [friendCodeV3ExpiryUnixMs, setFriendCodeV3ExpiryUnixMs] = useState<number | null>(null);
    const [resolvedIdentity, setResolvedIdentity] = useState<ResolvedIdentity | null>(null);
    const [resolverMessage, setResolverMessage] = useState<string | null>(null);
    const [directRequestPhase, setDirectRequestPhase] = useState<DirectRequestPhase>("idle");
    const [directRequestMessage, setDirectRequestMessage] = useState<string | null>(null);
    const [invitationDialogTarget, setInvitationDialogTarget] = useState<ResolvedIdentity | null>(null);
    const [requestIntroText, setRequestIntroText] = useState<string>(DEFAULT_INVITATION_INTRO);
    const [requestNoteText, setRequestNoteText] = useState<string>("");
    const [requestSecretCode, setRequestSecretCode] = useState<string>("");
    const [previewProfile, setPreviewProfile] = useState<PublicDiscoveryProfile | null>(null);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [friendSuggestionsReady, setFriendSuggestionsReady] = useState(false);
    const [diagnosticsTick, setDiagnosticsTick] = useState(0);
    const unknownContactLabel = t("search.discovery.identity.unknownContact");
    const resolvedMetadata = useResolvedProfileMetadata(resolvedIdentity?.pubkey ?? null);
    const isResolvedIdentitySelf = Boolean(resolvedIdentity && publicKeyHex && resolvedIdentity.pubkey === publicKeyHex);
    const navigateToProfile = React.useCallback((targetPubkey: string): void => {
        if (publicKeyHex && targetPubkey === publicKeyHex) {
            router.push("/settings#profile");
            return;
        }
        router.push(getPublicProfileHref(targetPubkey));
    }, [publicKeyHex, router]);
    const focusDiscoveryTargetThen = React.useCallback((elementId: string, action: () => void, options?: Readonly<{
        scrollDelayMs?: number;
        actionDelayMs?: number;
    }>): void => {
        focusSearchTargetById(elementId, {
            scrollDelayMs: options?.scrollDelayMs ?? 40,
            block: "center",
        });
        window.setTimeout(action, options?.actionDelayMs ?? 420);
    }, []);
    React.useEffect(() => {
        if (!resolvedIdentity) {
            return;
        }
        focusSearchTargetById(DISCOVERY_EXACT_MATCH_ELEMENT_ID, {
            scrollDelayMs: 180,
            block: "center",
        });
    }, [resolvedIdentity?.pubkey]);
    const buildResolvedPreviewProfile = React.useCallback((identity: ResolvedIdentity): PublicDiscoveryProfile => {
        const base = mapResolvedIdentityToPublicDiscoveryProfile(identity);
        const isSelf = Boolean(publicKeyHex && identity.pubkey === publicKeyHex);
        const localUsername = profile.state.profile.username.trim();
        const localAbout = (profile.state.profile.about || "").trim();
        const localNip05 = (profile.state.profile.nip05 || "").trim();
        const localAvatar = normalizePublicUrl(profile.state.profile.avatarUrl);
        return {
            ...base,
            title: resolvedMetadata?.displayName || identity.display || (isSelf ? localUsername : "") || unknownContactLabel,
            subtitle: resolvedMetadata?.nip05 || (isSelf ? localNip05 : "") || identity.source.replace("_", " "),
            description: resolvedMetadata?.about || (isSelf ? localAbout : "") || undefined,
            picture: resolvedMetadata?.avatarUrl || (isSelf ? localAvatar : "") || undefined,
        };
    }, [
        profile.state.profile.about,
        profile.state.profile.avatarUrl,
        profile.state.profile.nip05,
        profile.state.profile.username,
        publicKeyHex,
        resolvedMetadata?.about,
        resolvedMetadata?.avatarUrl,
        resolvedMetadata?.displayName,
        resolvedMetadata?.nip05,
        unknownContactLabel,
    ]);
    const { results, isSearching, queryState, error, search, clearResults, } = useGlobalSearch({
        myPublicKeyHex: publicKeyHex,
        intent: mapSurfaceToIntent(surface),
    });
    const identityResolver = useIdentityResolver();
    const dmController = useEnhancedDMController({
        myPublicKeyHex: publicKeyHex,
        myPrivateKeyHex: privateKeyHex,
        pool: relayPool,
        blocklist,
        peerTrust,
        requestsInbox,
        autoSubscribeIncoming: false,
        enableIncomingTransport: false,
    });
    const requestTransport = useRequestTransport({
        dmController,
        peerTrust,
        requestsInbox,
    });
    const requestOutbox = useContactRequestOutbox({
        myPublicKeyHex: publicKeyHex,
        sendConnectionRequest: requestTransport.sendConnectionRequestRaw,
        getRequestStatus: requestsInbox.getRequestStatus,
        setRequestStatus: requestsInbox.setStatus,
    });
    const outboxStatusMapRef = useRef<Map<string, ContactRequestRecord["status"]>>(new Map());
    const outboxStatusInitializedRef = useRef(false);
    const inviteResolver = useInviteResolver({ myPublicKeyHex: publicKeyHex });
    const myNpub = useMemo(() => {
        if (!publicKeyHex)
            return "";
        try {
            return nip19.npubEncode(publicKeyHex);
        }
        catch {
            return "";
        }
    }, [publicKeyHex]);
    const resolveSafeInput = React.useCallback(async (input: string): Promise<ResolveResult> => {
        const trimmed = input.trim();
        const normalized = trimmed.toUpperCase();
        if (isValidInviteCode(normalized)) {
            const resolvedInvite = await inviteResolver.resolveCode(normalized);
            if (resolvedInvite) {
                return {
                    ok: true,
                    identity: {
                        pubkey: resolvedInvite.publicKeyHex,
                        display: resolvedInvite.displayName,
                        source: "legacy_code",
                        confidence: "relay_confirmed",
                    },
                };
            }
            return {
                ok: false,
                reason: "legacy_code_unresolvable",
                message: t("search.discovery.identity.legacyUnresolvable"),
            };
        }
        return resolveStableIdentity(trimmed, {
            invalidInput: t("search.discovery.identity.invalidInput"),
            unsupportedToken: t("search.discovery.identity.unsupportedToken"),
        });
    }, [inviteResolver, t]);
    const lastSearchedRef = useRef("");
    useEffect(() => {
        let cancelled = false;
        const cancelIdle = scheduleIdleWork(() => {
            if (cancelled) {
                return;
            }
            const saved = localStorage.getItem(getRecentSearchesStorageKey()) ?? localStorage.getItem(LEGACY_RECENT_SEARCHES_STORAGE_KEY);
            if (!saved) {
                setRecentSearches([]);
                return;
            }
            try {
                setRecentSearches(JSON.parse(saved));
            }
            catch {
                setRecentSearches([]);
            }
        });
        return () => {
            cancelled = true;
            cancelIdle();
        };
    }, []);
    useEffect(() => {
        const syncPrivacySettings = (): void => {
            setPrivacySettings(PrivacySettingsService.getSettings());
        };
        window.addEventListener("privacy-settings-changed", syncPrivacySettings);
        return () => {
            window.removeEventListener("privacy-settings-changed", syncPrivacySettings);
        };
    }, []);
    useEffect(() => {
        if (!initialQuery || initialQuery === lastSearchedRef.current)
            return;
        if (isDeterministicDirectQuery(initialQuery, { allowLegacyInviteCode })) {
            if (surface !== "add_friend") {
                setSurface("add_friend");
            }
            const resolvePromise = deterministicDiscoveryEnabled
                ? identityResolver.resolve(initialQuery, { allowLegacyInviteCode })
                : resolveSafeInput(initialQuery);
            void resolvePromise.then((resolved) => {
                if (resolved.ok) {
                    setResolvedIdentity(resolved.identity);
                    setResolverMessage(`Resolved via ${resolved.identity.source.replace("_", " ")}`);
                }
                else {
                    setResolvedIdentity(null);
                    setResolverMessage(resolved.message);
                }
                clearResults();
            });
        }
        else {
            void search(initialQuery, mapSurfaceToIntent(surface));
        }
        lastSearchedRef.current = initialQuery;
    }, [allowLegacyInviteCode, clearResults, deterministicDiscoveryEnabled, identityResolver, initialQuery, resolveSafeInput, search, surface]);
    useEffect(() => {
        if (!publicKeyHex) {
            setShareCardEncoded("");
            setShareLink("");
            setShareQrDataUrl("");
            setFriendCodeV2("");
            setFriendCodeV3("");
            setFriendCodeV3ExpiryUnixMs(null);
            return;
        }
        if (surface !== "add_friend" && !shareDialogOpen) {
            return;
        }
        let cancelled = false;
        const cancelIdle = scheduleIdleWork(() => {
            if (cancelled) {
                return;
            }
            void createSignedContactCard({
                pubkey: publicKeyHex,
                privateKeyHex,
                relays: enabledRelayUrls,
                label: profile.state.profile.username || undefined,
                inviteCode: profile.state.profile.inviteCode || undefined,
            }).then((card) => {
                if (cancelled)
                    return;
                const encoded = encodeContactCard(card);
                const deepLink = buildContactCardDeepLink(card);
                const nextFriendCode = encodeFriendCodeV2({
                    pubkey: publicKeyHex,
                    relays: enabledRelayUrls,
                }) ?? "";
                const now = Date.now();
                const ttlMs = 10 * 60 * 1000;
                const nextFriendCodeV3 = encodeFriendCodeV3({
                    pubkey: publicKeyHex,
                    relays: enabledRelayUrls,
                    ttlMs,
                    singleUse: false,
                    nowUnixMs: now,
                }) ?? "";
                setShareCardEncoded(encoded);
                setShareLink(deepLink);
                setFriendCodeV2(nextFriendCode);
                setFriendCodeV3(nextFriendCodeV3);
                setFriendCodeV3ExpiryUnixMs(now + ttlMs);
                void QRCode.toDataURL(deepLink, {
                    width: 260,
                    margin: 1,
                    color: { dark: "#111111", light: "#ffffff" },
                }).then(setShareQrDataUrl).catch(() => setShareQrDataUrl(""));
            });
        });
        return () => {
            cancelled = true;
            cancelIdle();
        };
    }, [
        enabledRelayUrls,
        privateKeyHex,
        profile.state.profile.inviteCode,
        profile.state.profile.username,
        publicKeyHex,
        shareDialogOpen,
        surface,
    ]);
    useEffect(() => {
        if (!discoveryFeatureFlags.suggestionsV1) {
            setFriendSuggestionsReady(false);
            return;
        }
        let cancelled = false;
        const cancelIdle = scheduleIdleWork(() => {
            if (!cancelled) {
                setFriendSuggestionsReady(true);
            }
        });
        return () => {
            cancelled = true;
            cancelIdle();
        };
    }, [discoveryFeatureFlags.suggestionsV1]);
    useEffect(() => {
        const previous = outboxStatusMapRef.current;
        const next = new Map<string, ContactRequestRecord["status"]>();
        if (!outboxStatusInitializedRef.current) {
            for (const record of requestOutbox.state.records) {
                next.set(record.id, record.status);
            }
            outboxStatusMapRef.current = next;
            outboxStatusInitializedRef.current = true;
            return;
        }
        for (const record of requestOutbox.state.records) {
            const prevStatus = previous.get(record.id);
            next.set(record.id, record.status);
            if (prevStatus === record.status) {
                continue;
            }
            if (record.status === "sent_quorum") {
                emitDeliveryToast({
                    status: "sent_quorum",
                    message: t("search.discovery.invitation.deliveredToQuorum"),
                    relaySuccessCount: record.publishReport?.successCount,
                    relayTotal: record.publishReport?.totalRelays,
                });
            }
            else if (record.status === "sent_partial") {
                const successCount = record.publishReport?.successCount ?? 0;
                const totalRelays = record.publishReport?.totalRelays ?? 0;
                emitDeliveryToast({
                    status: "sent_partial",
                    message: t("search.discovery.invitation.partiallyDelivered", {
                        success: successCount,
                        total: totalRelays || "?",
                    }),
                    relaySuccessCount: successCount,
                    relayTotal: totalRelays,
                });
            }
            else if (record.status === "failed") {
                if (record.nextRetryAtUnixMs && record.nextRetryAtUnixMs > Date.now()) {
                    emitDeliveryToast({
                        status: "queued_retrying",
                        message: t("search.discovery.invitation.queuedRetrying"),
                        retryAtUnixMs: record.nextRetryAtUnixMs,
                    });
                }
                else {
                    emitDeliveryToast({
                        status: "failed",
                        message: record.error || t("search.discovery.invitation.requestFailed"),
                    });
                }
            }
        }
        outboxStatusMapRef.current = next;
    }, [requestOutbox.state.records]);
    const addToRecent = (searchTerm: string): void => {
        if (!searchTerm.trim())
            return;
        const next = [searchTerm, ...recentSearches.filter((entry) => entry !== searchTerm)].slice(0, 8);
        setRecentSearches(next);
        localStorage.setItem(getRecentSearchesStorageKey(), JSON.stringify(next));
    };
    const clearSearch = (): void => {
        setQuery("");
        clearResults();
        identityResolver.reset();
        setResolvedIdentity(null);
        setResolverMessage(null);
        setDirectRequestPhase("idle");
        setDirectRequestMessage(null);
        lastSearchedRef.current = "";
        const params = new URLSearchParams(searchParams);
        params.delete("q");
        window.history.replaceState(null, "", "/search");
    };
    const handleSearch = (event?: React.FormEvent): void => {
        event?.preventDefault();
        const trimmed = query.trim();
        if (!trimmed)
            return;
        const isRepeatDeterministicSearch = (isDeterministicDirectQuery(trimmed, { allowLegacyInviteCode })
            && trimmed === lastSearchedRef.current
            && (!!resolvedIdentity || filteredResults.length > 0));
        if (isRepeatDeterministicSearch) {
            return;
        }
        if (isDeterministicDirectQuery(trimmed, { allowLegacyInviteCode })) {
            if (surface !== "add_friend") {
                setSurface("add_friend");
            }
            setDirectRequestPhase("idle");
            setDirectRequestMessage(null);
            const resolvePromise = deterministicDiscoveryEnabled
                ? identityResolver.resolve(trimmed, { allowLegacyInviteCode })
                : resolveSafeInput(trimmed);
            void resolvePromise.then((resolved) => {
                if (resolved.ok) {
                    setResolvedIdentity(resolved.identity);
                    setResolverMessage(`Resolved via ${resolved.identity.source.replace("_", " ")}`);
                }
                else {
                    setResolvedIdentity(null);
                    setResolverMessage(resolved.message);
                }
                clearResults();
            });
        }
        else {
            setResolvedIdentity(null);
            setResolverMessage(null);
            void search(trimmed, mapSurfaceToIntent(surface));
        }
        addToRecent(trimmed);
        lastSearchedRef.current = trimmed;
        const params = new URLSearchParams(searchParams);
        params.set("q", trimmed);
        window.history.replaceState(null, "", `?${params.toString()}`);
    };
    const filteredResults = useMemo((): ReadonlyArray<DiscoveryResult> => {
        if (surface === "communities") {
            return results.filter((entry) => entry.kind === "community");
        }
        if (surface === "add_friend") {
            return results.filter((entry) => entry.kind !== "community");
        }
        return results;
    }, [results, surface]);
    const friendSuggestions = useMemo(() => {
        if (!discoveryFeatureFlags.suggestionsV1 || !friendSuggestionsReady) {
            return [];
        }
        return buildFriendSuggestions({
            profiles: discoveryCache.getProfiles(200),
            myPublicKeyHex: publicKeyHex,
            acceptedPeers: peerTrust.state.acceptedPeers,
            blockedPeers: blocklist.state.blockedPublicKeys,
            excludedPeers: requestsInbox.state.items.map((item) => item.peerPublicKeyHex),
            limit: 6,
        });
    }, [
        blocklist.state.blockedPublicKeys,
        discoveryFeatureFlags.suggestionsV1,
        friendSuggestionsReady,
        peerTrust.state.acceptedPeers,
        publicKeyHex,
        requestsInbox.state.items,
    ]);
    const reasonLabel = useMemo(() => {
        switch (queryState.reasonCode) {
            case "relay_degraded":
                return t("search.discovery.reason.relayDegraded");
            case "offline":
                return t("search.discovery.reason.offline");
            case "no_match":
                return t("search.discovery.reason.noMatch");
            case "unsupported_token":
                return t("search.discovery.reason.unsupportedToken");
            case "invalid_code":
                return t("search.discovery.reason.invalidCode");
            case "expired_code":
                return t("search.discovery.reason.expiredCode");
            case "code_used":
                return t("search.discovery.reason.codeUsed");
            case "legacy_code_unresolvable":
                return t("search.discovery.reason.legacyUnresolvable");
            case "index_unavailable_fallback":
                return t("search.discovery.reason.indexFallback");
            case "index_unavailable":
                return t("search.discovery.reason.indexUnavailable");
            default:
                return null;
        }
    }, [queryState.reasonCode, t]);
    const relaySearchLabel = useMemo(() => {
        switch (relayRecovery.readiness) {
            case "recovering":
                return t("search.discovery.relay.recovering");
            case "degraded":
                return t("search.discovery.relay.degraded");
            case "offline":
                return t("search.discovery.relay.offline");
            default:
                return null;
        }
    }, [relayRecovery.readiness, t]);
    const sourceStatusLabel = React.useCallback((state: string): string => {
        if (state === "running")
            return t("search.discovery.source.running");
        if (state === "success")
            return t("search.discovery.source.ok");
        if (state === "error")
            return t("search.discovery.source.error");
        if (state === "timeout")
            return t("search.discovery.source.timeout");
        if (state === "skipped")
            return t("search.discovery.source.skipped");
        return t("search.discovery.source.idle");
    }, [t]);
    const hasDeterministicQuery = isDeterministicDirectQuery(query, { allowLegacyInviteCode });
    const showResolvedState = (surface === "add_friend"
        && (hasDeterministicQuery
            || Boolean(resolvedIdentity)
            || Boolean(resolverMessage)
            || identityResolver.phase === "resolving"));
    void diagnosticsTick;
    const discoveryDiagnosticsSnapshot = discoverySessionDiagnosticsStore.getSnapshot();
    const copyText = async (value: string, successLabel: string): Promise<void> => {
        if (!value)
            return;
        try {
            await navigator.clipboard.writeText(value);
            toast.success(successLabel);
        }
        catch {
            toast.error(t("search.discovery.copy.failed"));
        }
    };
    const openInvitationDialog = (target: ResolvedIdentity): void => {
        setInvitationDialogTarget(target);
    };
    const sendDirectRequest = async (target: ResolvedIdentity, values: InvitationComposerValues): Promise<boolean> => {
        if (!target.pubkey || directRequestPhase === "sending") {
            return false;
        }
        setDirectRequestPhase("sending");
        setDirectRequestMessage(t("search.discovery.invitation.attemptingDelivery"));
        try {
            const report = await withTimeout(requestTransport.sendRequest({
                peerPublicKeyHex: target.pubkey as PublicKeyHex,
                introMessage: buildInvitationRequestMessage(values),
            }), REQUEST_SEND_TIMEOUT_MS, t("search.discovery.invitation.timeout"));
            if (report.status === "ok") {
                setDirectRequestPhase("ok");
                setDirectRequestMessage(t("search.discovery.invitation.delivered"));
                toast.success(getDirectInvitationToastCopy("ok").message);
                return true;
            }
            if (report.status === "partial") {
                setDirectRequestPhase("partial");
                setDirectRequestMessage(t("search.discovery.invitation.partial"));
                toast.warning(getDirectInvitationToastCopy("partial", {
                    relaySuccessCount: report.relaySuccessCount,
                    relayTotal: report.relayTotal,
                }).message);
                return true;
            }
            if (report.status === "queued") {
                setDirectRequestPhase("queued");
                setDirectRequestMessage(report.message || t("search.discovery.invitation.waitingForRelay"));
                toast.warning(getDirectInvitationToastCopy("queued", {
                    message: report.message,
                }).message);
                return true;
            }
            setDirectRequestPhase(report.status);
            setDirectRequestMessage(report.message || t("search.discovery.invitation.deliveryUnconfirmed"));
            toast.error(getDirectInvitationToastCopy(report.status, {
                message: report.message,
            }).message);
            return false;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : t("search.discovery.invitation.deliveryUnconfirmed");
            setDirectRequestPhase("failed");
            setDirectRequestMessage(message);
            toast.error(getDirectInvitationToastCopy("failed", { message }).message);
            return false;
        }
    };
    const handleInvitationDialogSubmit = async (values: InvitationComposerValues): Promise<boolean> => {
        if (!invitationDialogTarget) {
            return false;
        }
        setRequestIntroText(values.intro);
        setRequestNoteText(values.note);
        setRequestSecretCode(values.secretCode);
        if (deterministicDiscoveryEnabled) {
            const queued = requestOutbox.queueRequest({
                peerPubkey: invitationDialogTarget.pubkey as PublicKeyHex,
                introMessage: buildInvitationRequestMessage(values),
            });
            toast.success(`Invitation queued (${queued.id.slice(0, 8)})`);
            void requestOutbox.processQueue();
            return true;
        }
        return sendDirectRequest(invitationDialogTarget, values);
    };
    return (<PageShell title={t("search.title")} navBadgeCounts={navBadges.navBadgeCounts} hideHeader>
      <div className="flex h-full flex-col bg-background">
        <div className="sticky top-0 z-30 border-b border-border/50 bg-background/90 px-3 py-2 backdrop-blur-xl sm:px-4 sm:py-4">
          <div className="mx-auto w-full max-w-6xl">
            <div>
                <div className={cn("relative overflow-hidden border border-black/10 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.24),_transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,247,255,0.9))] shadow-[0_28px_80px_rgba(15,23,42,0.16)] dark:border-border/60 dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_48%),linear-gradient(180deg,rgba(10,16,34,0.76),rgba(6,10,22,0.92))] dark:shadow-[0_28px_80px_rgba(0,0,0,0.22)]", isMobileDiscoveryCompact
            ? "rounded-2xl px-3 py-3 shadow-none"
            : "rounded-[26px] px-4 py-4 sm:rounded-[36px] sm:px-6 sm:py-6")}>
                  {!isMobileDiscoveryCompact ? (<>
                      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full bg-indigo-500/20 blur-3xl dark:bg-indigo-400/20"/>
                      <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-400/15"/>
                    </>) : null}
                  <div className={cn("relative mx-auto max-w-4xl", isMobileDiscoveryCompact ? "text-left" : "text-center")}>
                    {!isMobileDiscoveryCompact ? (<p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-600 dark:text-zinc-400">{t("search.discovery.hero.eyebrow")}</p>) : null}
                    <h1 className={cn("font-black tracking-tight text-zinc-950 dark:text-zinc-100", isMobileDiscoveryCompact
            ? "mt-0 text-lg leading-snug"
            : "mx-auto mt-2.5 max-w-[16ch] text-[1.55rem] leading-[1.06] sm:mt-3 sm:max-w-none sm:text-4xl")}>
                      {isMobileDiscoveryCompact
            ? t("search.discovery.hero.titleCompact")
            : t("search.discovery.hero.title")}
                    </h1>
                    {!isMobileDiscoveryCompact ? (<p className="mx-auto mt-2.5 max-w-[30ch] text-[0.95rem] leading-relaxed text-zinc-700 dark:text-zinc-300 sm:mt-3 sm:max-w-3xl sm:text-base">
                        {t("search.discovery.hero.desc")}
                      </p>) : null}
                  </div>

                  <form onSubmit={handleSearch} className={cn("mx-auto grid w-full max-w-4xl grid-cols-[1fr_auto] items-center gap-2 rounded-[20px] border border-black/10 bg-white/85 p-2 ring-1 ring-white/35 dark:border-border/60 dark:bg-background/80 dark:ring-white/10", isMobileDiscoveryCompact
            ? "mt-3 rounded-xl shadow-none"
            : "mt-4 shadow-[0_12px_40px_rgba(15,23,42,0.14)] sm:mt-6 sm:gap-3 sm:rounded-[28px] sm:p-3 dark:shadow-[0_12px_40px_rgba(0,0,0,0.18)]")}>
                    <div className="flex items-center gap-2 rounded-xl bg-background/55 px-3 py-2 sm:rounded-2xl sm:bg-transparent sm:px-1 sm:py-0">
                      <SearchIcon className="h-4 w-4 text-zinc-500 dark:text-muted-foreground"/>
                      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={surface === "add_friend"
            ? (deterministicDiscoveryEnabled
                ? (allowLegacyInviteCode
                    ? t("search.discovery.placeholder.addFriendDeterministicLegacy")
                    : t("search.discovery.placeholder.addFriendDeterministic"))
                : (allowLegacyInviteCode
                    ? t("search.discovery.placeholder.addFriendLegacy")
                    : t("search.discovery.placeholder.addFriend")))
            : surface === "communities"
                ? t("search.discovery.placeholder.communities")
                : t("search.discovery.placeholder.global")} className="h-9 flex-1 border-none bg-transparent p-0 text-[0.95rem] sm:h-12 sm:text-base focus-visible:ring-0"/>
                      {query ? (<Button type="button" variant="ghost" size="icon" className="h-8 w-8 rounded-full sm:h-10 sm:w-10" onClick={clearSearch}>
                          <SearchX className="h-4 w-4"/>
                        </Button>) : null}
                    </div>
                    <Button type="submit" disabled={isSearching || !query.trim()} className="h-9 rounded-xl px-3 text-xs font-bold sm:h-11 sm:rounded-2xl sm:px-5 sm:text-sm">
                      {surface === "add_friend" && deterministicDiscoveryEnabled
            ? (identityResolver.phase === "resolving"
                ? t("search.discovery.action.resolving")
                : t("search.discovery.action.resolve"))
            : (isSearching ? t("common.searching") : t("search.discovery.action.search"))}
                    </Button>
                  </form>

                  <div className={cn("grid grid-cols-3 gap-1.5 sm:mt-5 sm:flex sm:flex-wrap sm:justify-center sm:gap-2", isMobileDiscoveryCompact ? "mt-3" : "mt-4")}>
            {(["global", "add_friend", "communities"] as DiscoverySurface[]).map((target) => (<button key={target} onClick={() => {
                setSurface(target);
                setDirectRequestPhase("idle");
                setDirectRequestMessage(null);
                if (target !== "add_friend") {
                    setResolvedIdentity(null);
                    setResolverMessage(null);
                    identityResolver.reset();
                }
                if (query.trim()) {
                    if (target === "add_friend") {
                        const resolvePromise = deterministicDiscoveryEnabled
                            ? identityResolver.resolve(query, { allowLegacyInviteCode })
                            : resolveSafeInput(query);
                        void resolvePromise.then((resolved) => {
                            if (resolved.ok) {
                                setResolvedIdentity(resolved.identity);
                                setResolverMessage(`Resolved via ${resolved.identity.source.replace("_", " ")}`);
                            }
                            else {
                                setResolvedIdentity(null);
                                setResolverMessage(resolved.message);
                            }
                        });
                    }
                    else {
                        void search(query, mapSurfaceToIntent(target));
                    }
                }
            }} className={cn("rounded-full border font-black uppercase transition-colors", isMobileDiscoveryCompact
                ? "h-9 px-1.5 text-[9px] tracking-[0.08em] sm:h-10 sm:px-4 sm:text-[11px] sm:tracking-[0.16em]"
                : "h-10 px-2 text-[10px] tracking-[0.12em] sm:px-4 sm:text-[11px] sm:tracking-[0.16em]", surface === target
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:text-foreground")}>
                  {target === "global"
                ? t("search.discovery.surface.global")
                : target === "add_friend"
                    ? t("search.discovery.surface.addFriend")
                    : t("search.discovery.surface.communities")}
              </button>))}
                  </div>

                  {!isMobileDiscoveryCompact ? (<div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-600 sm:mt-5 sm:gap-2 sm:text-[10px] sm:tracking-[0.18em] dark:text-muted-foreground">
                    <span className="rounded-full border border-border/60 px-2.5 py-1 sm:px-3">
                      {surface === "add_friend"
                ? (stabilityModeEnabled
                    ? t("search.discovery.phase.safeMode")
                    : (deterministicDiscoveryEnabled
                        ? t("search.discovery.phase.deterministicAdd")
                        : t("search.discovery.phase.directResolve")))
                : t("search.discovery.phase.search", { phase: queryState.phase })}
                    </span>
                    {surface === "global" && (<>
                        <span className="rounded-full border border-border/60 px-2.5 py-1 sm:px-3">{t("search.discovery.kind.people")}</span>
                        <span className="rounded-full border border-border/60 px-2.5 py-1 sm:px-3">{t("search.discovery.kind.communities")}</span>
                      </>)}
                  </div>) : null}
                </div>
            </div>
          </div>
        </div>

        <div className={cn("mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-y-auto px-3 pb-[calc(6.25rem+env(safe-area-inset-bottom))] sm:px-4 sm:pb-24", isMobileDiscoveryCompact ? "gap-3 py-3" : "gap-5 py-5 sm:gap-6 sm:py-6")}>
          {surface === "add_friend" && (<div className="space-y-4">
              <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{t("search.discovery.directAdd.eyebrow")}</p>
                      <div className="rounded-full border border-border px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {deterministicDiscoveryEnabled ? identityResolver.phase : "ready"}
                      </div>
                      {stabilityModeEnabled && (<div className="rounded-full border border-blue-500/30 bg-blue-500/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                          {t("search.discovery.phase.safeMode")}
                        </div>)}
                    </div>
                    <h3 className="mt-3 text-2xl font-black tracking-tight">{t("search.discovery.directAdd.title")}</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                      {allowLegacyInviteCode
                ? t("search.discovery.directAdd.descLegacy")
                : t("search.discovery.directAdd.desc")}
                    </p>
                  </div>

                  <Button onClick={() => setShareDialogOpen(true)} className="shrink-0">
                    <QrCode className="mr-2 h-4 w-4"/>
                    {t("search.discovery.directAdd.showMyContact")}
                  </Button>
                </div>
              </div>

              <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{t("search.discovery.diagnostics.eyebrow")}</p>
                    <h3 className="mt-2 text-lg font-black tracking-tight">{t("search.discovery.diagnostics.title")}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("search.discovery.diagnostics.desc")}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => {
                discoverySessionDiagnosticsStore.clear();
                setDiagnosticsTick((prev) => prev + 1);
            }}>
                    {t("common.clear")}
                  </Button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-xs">
                    {t("search.discovery.diagnostics.lookups")}: <span className="font-semibold">{discoveryDiagnosticsSnapshot.lookupCount}</span>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-xs">
                    {t("search.discovery.diagnostics.conversions")}: <span className="font-semibold">{discoveryDiagnosticsSnapshot.addConversionCount}</span>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-xs">
                    {t("search.discovery.diagnostics.lastSource")}: <span className="font-semibold">{discoveryDiagnosticsSnapshot.lastLookup?.primaryMatchSource ?? t("search.discovery.none")}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
                  <span className={cn("rounded-full border px-3 py-1", discoveryFeatureFlags.inviteCodeV1 ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-300" : "border-border text-muted-foreground")}>
                    {t("search.discovery.diagnostics.inviteCode")}:{discoveryFeatureFlags.inviteCodeV1 ? t("search.discovery.toggle.on") : t("search.discovery.toggle.off")}
                  </span>
                  <span className={cn("rounded-full border px-3 py-1", discoveryFeatureFlags.deepLinkV1 ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-300" : "border-border text-muted-foreground")}>
                    {t("search.discovery.diagnostics.deepLink")}:{discoveryFeatureFlags.deepLinkV1 ? t("search.discovery.toggle.on") : t("search.discovery.toggle.off")}
                  </span>
                  <span className={cn("rounded-full border px-3 py-1", discoveryFeatureFlags.suggestionsV1 ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-300" : "border-border text-muted-foreground")}>
                    {t("search.discovery.diagnostics.suggestions")}:{discoveryFeatureFlags.suggestionsV1 ? t("search.discovery.toggle.on") : t("search.discovery.toggle.off")}
                  </span>
                </div>
                {discoveryDiagnosticsSnapshot.lastLookup ? (<p className="mt-3 text-xs text-muted-foreground">
                    {t("search.discovery.diagnostics.lastLookup", {
                    latency: discoveryDiagnosticsSnapshot.lastLookup.latencyMs ?? 0,
                    count: discoveryDiagnosticsSnapshot.lastLookup.resultCount,
                    phase: discoveryDiagnosticsSnapshot.lastLookup.phase,
                })}
                  </p>) : null}
              </div>

              <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{t("search.discovery.exactMatch.eyebrow")}</p>
                    <h3 className="mt-2 text-lg font-black tracking-tight">{t("search.discovery.exactMatch.title")}</h3>
                  </div>
                  {resolverMessage ? (<div className="max-w-sm rounded-2xl border border-border/50 bg-background/50 px-4 py-2 text-right text-xs text-muted-foreground">
                      {resolverMessage}
                    </div>) : null}
                </div>
                <div className="mt-4 space-y-3">
                  {resolvedIdentity ? (<div id={DISCOVERY_EXACT_MATCH_ELEMENT_ID} role="button" tabIndex={0} onClick={() => navigateToProfile(resolvedIdentity.pubkey)} onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigateToProfile(resolvedIdentity.pubkey);
                    }
                }} className="cursor-pointer rounded-[28px] border border-emerald-500/30 bg-emerald-500/5 p-5 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                          <Avatar className="h-16 w-16 border border-emerald-500/30">
                          <AvatarImage src={resolvedMetadata?.avatarUrl || (isResolvedIdentitySelf ? profile.state.profile.avatarUrl : undefined)} alt={resolvedMetadata?.displayName || resolvedIdentity.display || resolvedIdentity.pubkey} className="object-cover"/>
                          <AvatarFallback className="font-black">
                            {getProfileInitials(resolvedMetadata?.displayName || resolvedIdentity.display || unknownContactLabel)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black text-foreground">
                            {resolvedMetadata?.displayName || resolvedIdentity.display || unknownContactLabel}
                          </p>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {resolvedMetadata?.nip05 || resolvedIdentity.source.replace("_", " ")}
                          </p>
                          {resolvedMetadata?.about ? (<p className="mt-2 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                              {resolvedMetadata.about}
                            </p>) : null}
                        </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <Button size="sm" disabled={directRequestPhase === "sending"} onClick={(event) => {
                    event.stopPropagation();
                    openInvitationDialog(resolvedIdentity);
                }}>
                            {directRequestPhase === "sending"
                    ? t("search.discovery.action.sendingInvitation")
                    : t("search.discovery.action.sendInvitation")}
                          </Button>
                          <Button variant="outline" size="sm" onClick={(event) => {
                    event.stopPropagation();
                    navigateToProfile(resolvedIdentity.pubkey);
                }}>
                            {t("search.discovery.action.viewProfile")}
                          </Button>
                          <Button variant="outline" size="sm" onClick={(event) => {
                    event.stopPropagation();
                    void copyText(resolvedIdentity.pubkey, "Pubkey copied");
                }}>
                            {t("search.discovery.action.copyPubkey")}
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-border/50 bg-background/40 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{t("search.discovery.preview.publicKey")}</p>
                          <p className="mt-1 break-all font-mono text-xs text-foreground">{resolvedIdentity.pubkey}</p>
                        </div>
                        <div className="rounded-2xl border border-border/50 bg-background/40 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{t("search.discovery.preview.resolverSource")}</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{resolvedIdentity.source.replace("_", " ")}</p>
                        </div>
                      </div>

                      {!deterministicDiscoveryEnabled && directRequestMessage ? ((() => {
                    const invitationStatus = getDirectInvitationStatusCopy(directRequestPhase, {
                        message: directRequestMessage,
                    });
                    if (!invitationStatus) {
                        return null;
                    }
                    return (<div className={cn("mt-3 rounded-2xl border px-3 py-3", invitationToneClassName(invitationStatus.tone))}>
                              <p className="text-[10px] font-black uppercase tracking-[0.18em]">{invitationStatus.badge}</p>
                              <p className="mt-1 text-sm font-semibold">{invitationStatus.title}</p>
                              <p className="mt-1 text-xs leading-relaxed opacity-90">{invitationStatus.detail}</p>
                            </div>);
                })()) : null}
                    </div>) : showResolvedState ? (<div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-5 py-6">
                      <p className="text-sm font-semibold text-foreground">
                        {identityResolver.phase === "resolving"
                    ? t("search.discovery.exactMatch.resolvingTitle")
                    : t("search.discovery.exactMatch.noExactTitle")}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {identityResolver.phase === "resolving"
                    ? t("search.discovery.exactMatch.resolvingDesc")
                    : (resolverMessage || (allowLegacyInviteCode
                        ? t("search.discovery.exactMatch.noExactDescLegacy")
                        : t("search.discovery.exactMatch.noExactDesc")))}
                      </p>
                    </div>) : (<div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-5 py-6 text-center">
                      <p className="text-sm font-semibold text-foreground">{t("search.discovery.exactMatch.emptyTitle")}</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {allowLegacyInviteCode
                    ? t("search.discovery.exactMatch.emptyDescLegacy")
                    : t("search.discovery.exactMatch.emptyDesc")}
                      </p>
                    </div>)}
                </div>
              </div>

              {deterministicDiscoveryEnabled && requestOutbox.state.records.length > 0 && (<div className="rounded-3xl border border-border/60 bg-card/70 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.16em]">{t("search.discovery.invitation.title")}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("search.discovery.invitation.timelineDesc")}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => requestOutbox.clearTerminal()}>
                      {t("search.discovery.invitation.clearDone")}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {requestOutbox.state.records.slice(0, 6).map((record) => (<div key={record.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/20 px-3 py-3">
                        <div className="min-w-0 flex-1">
                          {(() => {
                        const invitationStatus = getInvitationOutboxStatusCopy(record);
                        return (<>
                                <div className={cn("inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em]", invitationToneClassName(invitationStatus.tone))}>
                                  {invitationStatus.badge}
                                </div>
                                <p className="mt-2 text-sm font-semibold text-foreground">{invitationStatus.title}</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{invitationStatus.detail}</p>
                              </>);
                    })()}
                          <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{record.peerPubkey}</p>
                          {record.publishReport && (<p className="text-[11px] text-muted-foreground">
                              {t("search.discovery.invitation.relayConfirmations")}: {record.publishReport.successCount}/{record.publishReport.totalRelays}
                            </p>)}
                          {record.error && (<p className="truncate text-[11px] text-rose-600 dark:text-rose-300">{record.error}</p>)}
                        </div>
                        {record.status === "failed" && (<Button variant="outline" size="sm" disabled={!!record.blockReason && record.blockReason !== "cooldown_active"} onClick={() => requestOutbox.retryNow(record.id)}>
                            {t("common.retry")}
                          </Button>)}
                      </div>))}
                  </div>
                </div>)}

              {discoveryFeatureFlags.suggestionsV1 && !query.trim() && !resolvedIdentity && friendSuggestions.length > 0 && (<div className="rounded-3xl border border-border/60 bg-card/70 p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.16em]">{t("search.discovery.suggestions.title")}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("search.discovery.suggestions.desc")}
                      </p>
                    </div>
                    <span className="rounded-full border border-border/60 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      {t("search.discovery.suggestions.localCache")}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {friendSuggestions.map((suggestion) => (<div key={suggestion.pubkey} id={discoverySuggestionElementId(suggestion.pubkey)} className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/20 px-3 py-3">
                        <div className="min-w-0 flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-border/60">
                            <AvatarImage src={suggestion.picture} alt={suggestion.displayName} className="object-cover"/>
                            <AvatarFallback className="font-black">
                              {getProfileInitials(suggestion.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{suggestion.displayName}</p>
                            <p className="truncate text-xs text-muted-foreground">{suggestion.subtitle || t("search.discovery.suggestions.identityHidden")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => {
                        setQuery(suggestion.pubkey);
                        setResolvedIdentity({
                            pubkey: suggestion.pubkey as PublicKeyHex,
                            display: suggestion.displayName,
                            inviteCode: suggestion.inviteCode,
                            source: "hex",
                            confidence: "cached_only",
                        });
                        setResolverMessage("Resolved via local suggestion cache");
                        window.setTimeout(() => {
                            focusSearchTargetById(DISCOVERY_EXACT_MATCH_ELEMENT_ID, {
                                scrollDelayMs: 80,
                                block: "center",
                            });
                        }, 120);
                    }}>
                            Use
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                        focusDiscoveryTargetThen(discoverySuggestionElementId(suggestion.pubkey), () => navigateToProfile(suggestion.pubkey));
                    }}>
                            View
                          </Button>
                        </div>
                      </div>))}
                  </div>
                </div>)}
            </div>)}

          {surface !== "add_friend" && relaySearchLabel && (<div className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm", relayRecovery.readiness === "offline"
                ? "border-rose-500/20 bg-rose-500/5 text-rose-700 dark:text-rose-300"
                : relayRecovery.readiness === "recovering"
                    ? "border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300"
                    : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
              {relayRecovery.readiness === "offline" ? (<WifiOff className="mt-0.5 h-4 w-4"/>) : (<AlertTriangle className="mt-0.5 h-4 w-4"/>)}
              <div>
                <p>{relaySearchLabel}</p>
              </div>
            </div>)}

          {surface !== "add_friend" && (reasonLabel || error) && (<div className={cn("flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm", queryState.reasonCode === "offline"
                ? "border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300")}>
              {queryState.reasonCode === "offline" ? (<WifiOff className="mt-0.5 h-4 w-4"/>) : (<AlertTriangle className="mt-0.5 h-4 w-4"/>)}
              <div>
                <p>{reasonLabel || error}</p>
              </div>
            </div>)}

          {surface !== "add_friend" && !isMobileDiscoveryCompact && (<div className="rounded-2xl border border-surface-contrast bg-gradient-surface-contrast p-3">
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
            <span className="col-span-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground sm:col-auto">Source Status</span>
            {(["local", "relay", "index"] as const).map((source) => (<span key={source} className={cn("text-center rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-widest sm:px-3 sm:text-[10px]", queryState.sourceStatusMap[source].state === "success" ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-300" :
                    queryState.sourceStatusMap[source].state === "running" ? "border-blue-500/30 text-blue-600 dark:text-blue-300" :
                        queryState.sourceStatusMap[source].state === "error" ? "border-rose-500/30 text-rose-600 dark:text-rose-300" :
                            "border-border text-muted-foreground")}>
                {source}:{sourceStatusLabel(queryState.sourceStatusMap[source].state)}
              </span>))}
            </div>
            </div>)}

          {surface !== "add_friend" && !query && recentSearches.length > 0 && (<div className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                <History className="h-4 w-4"/>
                Recent Searches
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {recentSearches.map((entry) => (<button key={entry} onClick={() => {
                    setQuery(entry);
                    void search(entry, mapSurfaceToIntent(surface));
                }} className="rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-left text-sm font-medium hover:border-primary/30">
                    {entry}
                  </button>))}
              </div>
            </div>)}

          {surface !== "add_friend" && query && filteredResults.length > 0 && (<div className="space-y-3">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                {isSearching
                ? t("common.searching")
                : t("search.discovery.resultsCount", {
                    count: filteredResults.length,
                    defaultValue: `${filteredResults.length} result${filteredResults.length === 1 ? "" : "s"}`,
                })}
              </div>
              <div className="flex flex-col gap-3">
                {filteredResults.map((result) => (<SearchResultCard key={result.canonicalId} result={result} targetElementId={discoverySearchResultElementId(result.canonicalId)} onClick={(entry) => {
                    const targetId = discoverySearchResultElementId(entry.canonicalId);
                    const pubkey = entry.display.pubkey;
                    if ((entry.kind === "person" || entry.kind === "invite" || entry.kind === "contact_card") && pubkey) {
                        focusDiscoveryTargetThen(targetId, () => navigateToProfile(pubkey));
                        return;
                    }
                    const communityId = entry.display.communityId;
                    if (entry.kind === "community" && communityId) {
                        focusDiscoveryTargetThen(targetId, () => router.push(getPublicGroupHref(communityId, entry.display.relayUrl)));
                    }
                }} onAdd={(entry) => {
                    if (!entry.display.pubkey)
                        return;
                    setSurface("add_friend");
                    setQuery(entry.display.pubkey);
                    const identity: ResolvedIdentity = {
                        pubkey: entry.display.pubkey,
                        display: entry.display.title,
                        source: "hex",
                        confidence: entry.confidence === "direct" ? "direct" : "relay_confirmed",
                    };
                    setResolvedIdentity(identity);
                    setResolverMessage(t("search.discovery.resolvedViaPublicPreview"));
                }}/>))}
              </div>
            </div>)}

          {surface !== "add_friend" && query && !isSearching && filteredResults.length === 0 && (<div className="flex min-h-[28vh] flex-col items-center justify-center rounded-[28px] border border-dashed border-border/70 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.1),_transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.65),rgba(255,255,255,0.25))] p-6 text-center sm:min-h-[35vh] sm:p-8 dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_52%),linear-gradient(180deg,rgba(10,16,34,0.55),rgba(6,10,22,0.45))]">
              <SearchX className="mb-4 h-9 w-9 text-muted-foreground/60"/>
              <h4 className="text-lg font-black sm:text-xl">{t("search.discovery.empty.title")}</h4>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                {t("search.discovery.empty.descPrefix")} <code>relay.example'group</code>.
              </p>
            </div>)}

          {surface !== "add_friend" && !query && recentSearches.length === 0 && !isMobileDiscoveryCompact && (<div className="flex min-h-[28vh] flex-col items-center justify-center rounded-[28px] border border-border/60 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.1),_transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.65),rgba(255,255,255,0.25))] p-6 text-center sm:min-h-[35vh] sm:p-8 dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_52%),linear-gradient(180deg,rgba(10,16,34,0.55),rgba(6,10,22,0.45))]">
              <UserPlus className="mb-4 h-10 w-10 text-primary/70"/>
              <h4 className="text-xl font-black sm:text-2xl">{t("search.discovery.start.title")}</h4>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {t("search.discovery.start.desc")}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <span className="rounded-full border border-border px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("search.discovery.kind.people")}</span>
                <span className="rounded-full border border-border px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("search.discovery.kind.communities")}</span>
                <span className="rounded-full border border-border px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("search.discovery.start.directAddChip")}</span>
              </div>
            </div>)}
        </div>
      </div>
      {previewProfile && (<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" onClick={() => setPreviewProfile(null)}>
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-background/95 via-background/90 to-background/95 p-5 shadow-2xl shadow-black/30" onClick={(event) => event.stopPropagation()}>
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl"/>
              <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"/>
            </div>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {previewProfile.kind === "person" ? (<Avatar className="h-14 w-14 border border-border/70">
                    <AvatarImage src={previewProfile.picture} alt={previewProfile.title} className="object-cover"/>
                    <AvatarFallback className="font-black">
                      {getProfileInitials(previewProfile.title)}
                    </AvatarFallback>
                  </Avatar>) : null}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    {previewProfile.kind === "community"
                ? t("search.discovery.preview.communityEyebrow")
                : t("search.discovery.preview.profileEyebrow")}
                  </p>
                  <h3 className="mt-1 text-2xl font-black">{previewProfile.title}</h3>
                  {previewProfile.subtitle ? (<p className="text-sm text-muted-foreground">{previewProfile.subtitle}</p>) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                    <span className="rounded-full border border-border px-2 py-1 text-muted-foreground">
                      {t("search.discovery.preview.confidence")}: {previewProfile.confidence}
                    </span>
                    <span className="rounded-full border border-border px-2 py-1 text-muted-foreground">
                      {t("search.discovery.preview.sources")}: {previewProfile.sources.join(", ")}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPreviewProfile(null)} className="h-8 w-8">
                <X className="h-4 w-4"/>
              </Button>
            </div>

            <div className="relative space-y-3 rounded-2xl border border-border/60 bg-card/55 p-4 text-sm backdrop-blur-sm">
              {previewProfile.kind === "person" ? (<ProfileCompletenessIndicator hasAvatar={!!(previewProfile.picture || (previewProfile.pubkey && publicKeyHex && previewProfile.pubkey === publicKeyHex && profile.state.profile.avatarUrl))} hasUsername={previewProfile.title.trim().length > 0} hasDescription={!!previewProfile.description?.trim()} hasNip05={isLikelyNip05Identifier(previewProfile.subtitle)}/>) : null}
              {previewProfile.description ? (<div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("search.discovery.preview.about")}</p>
                  <p className="mt-1 text-muted-foreground">{previewProfile.description}</p>
                </div>) : null}
              {previewProfile.pubkey ? (<div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("search.discovery.preview.publicKey")}</p>
                  <p className="mt-1 break-all font-mono text-xs">{previewProfile.pubkey}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("search.discovery.preview.shortKey")}: {compactKey(previewProfile.pubkey)}</p>
                </div>) : null}
              {previewProfile.npub ? (<div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("search.discovery.preview.npub")}</p>
                  <p className="mt-1 break-all font-mono text-xs">{previewProfile.npub}</p>
                </div>) : null}
              {previewProfile.communityId ? (<div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("search.discovery.preview.community")}</p>
                  <p className="mt-1 break-all font-mono text-xs">{previewProfile.communityId}</p>
                </div>) : null}
              {previewProfile.relayUrl ? (<div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("search.discovery.preview.declaredRelay")}</p>
                  <p className="mt-1 break-all font-mono text-xs">{previewProfile.relayUrl}</p>
                </div>) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
              {previewProfile.pubkey ? (<>
                  <Button className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-400 hover:to-blue-400" onClick={() => void copyText(previewProfile.pubkey || "", t("search.discovery.copy.pubkey"))}>
                    {t("search.discovery.action.copyContact")}
                  </Button>
                  <Button variant="outline" className="border-border/70 bg-background/50" onClick={() => {
                    if (!previewProfile.pubkey)
                        return;
                    const target: ResolvedIdentity = {
                        pubkey: previewProfile.pubkey,
                        display: previewProfile.title,
                        source: "hex",
                        confidence: previewProfile.confidence === "direct" ? "direct" : "relay_confirmed",
                    };
                    setSurface("add_friend");
                    setQuery(previewProfile.pubkey);
                    setResolvedIdentity(target);
                    setResolverMessage(t("search.discovery.resolvedViaPublicPreview"));
                    setPreviewProfile(null);
                    openInvitationDialog(target);
                }}>
                    {t("search.discovery.action.sendInvitation")}
                  </Button>
                  <Button variant="outline" className="border-border/70 bg-background/50" onClick={() => {
                    if (!previewProfile.pubkey)
                        return;
                    setSurface("add_friend");
                    setQuery(previewProfile.pubkey);
                    setResolvedIdentity({
                        pubkey: previewProfile.pubkey,
                        display: previewProfile.title,
                        source: "hex",
                        confidence: previewProfile.confidence === "direct" ? "direct" : "relay_confirmed",
                    });
                    setResolverMessage(t("search.discovery.resolvedViaPublicPreview"));
                    setPreviewProfile(null);
                }}>
                    {t("search.discovery.action.openInAddFriend")}
                  </Button>
                </>) : null}
              {previewProfile.kind === "community" && previewProfile.communityId ? (<Button variant="outline" className="border-border/70 bg-background/50" onClick={() => {
                    const communityId = previewProfile.communityId;
                    if (!communityId)
                        return;
                    router.push(getPublicGroupHref(communityId, previewProfile.relayUrl ?? undefined));
                }}>
                  {t("search.discovery.action.openFullPublicProfile")}
                </Button>) : null}
            </div>
          </div>
        </div>)}
      <InvitationComposerDialog isOpen={Boolean(invitationDialogTarget)} recipientName={invitationDialogTarget
            ? (resolvedMetadata?.displayName || invitationDialogTarget.display || unknownContactLabel)
            : t("search.discovery.identity.thisPerson")} recipientPubkey={invitationDialogTarget?.pubkey || ""} submitLabel={deterministicDiscoveryEnabled
            ? t("search.discovery.action.queueInvitation")
            : t("search.discovery.action.sendInvitation")} deliveryHint={deterministicDiscoveryEnabled
            ? t("search.discovery.invitation.queueHint")
            : t("search.discovery.invitation.deliveryHint")} defaults={{
            intro: requestIntroText,
            note: requestNoteText,
            secretCode: requestSecretCode,
        }} onClose={() => setInvitationDialogTarget(null)} onSubmit={handleInvitationDialogSubmit}/>
      {shareDialogOpen && (<div className="fixed inset-0 z-[130] bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShareDialogOpen(false)}>
          <div className="mx-auto mt-10 w-full max-w-4xl rounded-3xl border border-border/70 bg-background/95 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">{t("search.discovery.share.eyebrow")}</p>
                <h3 className="mt-1 text-xl font-black">{t("search.discovery.share.title")}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t("search.discovery.share.desc")}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShareDialogOpen(false)} className="h-8 w-8">
                <X className="h-4 w-4"/>
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4">
                {deterministicDiscoveryEnabled ? (<>
                    <div className="rounded-2xl border border-border/50 bg-muted/40 p-3 font-mono text-xs break-all">
                      {friendCodeV3 || t("search.discovery.share.shortCodeUnavailable")}
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 text-[11px] text-muted-foreground">
                      {t("search.discovery.share.expires")}: {friendCodeV3ExpiryUnixMs ? new Date(friendCodeV3ExpiryUnixMs).toLocaleTimeString() : t("search.discovery.na")}
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 font-mono text-xs break-all text-muted-foreground">
                      {t("search.discovery.share.compatibilityCode")}: {friendCodeV2 || t("search.discovery.none")}
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 font-mono text-xs break-all text-muted-foreground">
                      {t("search.discovery.share.legacyAlias")}: {profile.state.profile.inviteCode || t("search.discovery.none")}
                    </div>
                  </>) : (<>
                    <div className="rounded-2xl border border-border/50 bg-muted/30 p-3 font-mono text-xs break-all">
                      {profile.state.profile.inviteCode || t("search.discovery.share.inviteCodeUnavailable")}
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/40 p-3 font-mono text-xs break-all">
                      {myNpub || t("search.discovery.share.npubUnavailable")}
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 font-mono text-xs break-all text-muted-foreground">
                      {publicKeyHex || t("search.discovery.share.pubkeyUnavailable")}
                    </div>
                  </>)}
                <div className="flex flex-wrap gap-2">
                  {deterministicDiscoveryEnabled ? (<>
                      <Button variant="outline" size="sm" onClick={() => void copyText(friendCodeV2, t("search.discovery.copy.friendCode"))}>
                        <Copy className="mr-1 h-3 w-3"/>
                        {t("search.discovery.action.copyCompatibilityCode")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void copyText(friendCodeV3, t("search.discovery.copy.shortCode"))}>
                        <Copy className="mr-1 h-3 w-3"/>
                        {t("search.discovery.action.copyShortCode")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void copyText(profile.state.profile.inviteCode ?? "", t("search.discovery.copy.legacyAlias"))}>
                        <Copy className="mr-1 h-3 w-3"/>
                        {t("search.discovery.action.copyLegacyAlias")}
                      </Button>
                    </>) : (<>
                      <Button variant="outline" size="sm" onClick={() => void copyText(profile.state.profile.inviteCode ?? "", t("search.discovery.copy.inviteCode"))}>
                        <Copy className="mr-1 h-3 w-3"/>
                        {t("search.discovery.action.copyInviteCode")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void copyText(myNpub, t("search.discovery.copy.npub"))}>
                        <Copy className="mr-1 h-3 w-3"/>
                        {t("search.discovery.action.copyNpub")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void copyText(publicKeyHex ?? "", t("search.discovery.copy.pubkey"))}>
                        <Copy className="mr-1 h-3 w-3"/>
                        {t("search.discovery.action.copyPubkey")}
                      </Button>
                    </>)}
                  <Button variant="outline" size="sm" onClick={() => void copyText(shareLink, t("search.discovery.copy.contactLink"))}>
                    <Copy className="mr-1 h-3 w-3"/>
                    {t("search.discovery.action.copyLink")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void copyText(shareCardEncoded, t("search.discovery.copy.contactCard"))}>
                    <Copy className="mr-1 h-3 w-3"/>
                    {t("search.discovery.action.copyCard")}
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-primary"/>
                  <h3 className="text-sm font-black uppercase tracking-[0.16em]">{t("search.discovery.share.qrTitle")}</h3>
                </div>
                {shareQrDataUrl ? (
                  <Image
                    src={shareQrDataUrl}
                    alt="Contact QR"
                    width={208}
                    height={208}
                    unoptimized
                    className="h-52 w-52 rounded-2xl border border-border/50 bg-white p-3"
                  />
                ) : (<div className="flex h-52 w-52 items-center justify-center rounded-2xl border border-dashed border-border/70 text-xs text-muted-foreground">
                    {t("search.discovery.share.qrUnavailable")}
                  </div>)}
              </div>
            </div>
          </div>
        </div>)}
    </PageShell>);
}
