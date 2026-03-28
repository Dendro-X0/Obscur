"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { nip19 } from "nostr-tools";
import {
  ArrowLeft,
  AlertTriangle,
  X,
  Copy,
  History,
  QrCode,
  Search as SearchIcon,
  SearchX,
  UserPlus,
  WifiOff
} from "lucide-react";
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
import {
  buildContactCardDeepLink,
  createSignedContactCard,
  encodeContactCard,
  extractContactCardFromQuery
} from "@/app/features/search/services/contact-card";
import { encodeFriendCodeV2 } from "@/app/features/search/services/friend-code-v2";
import { encodeFriendCodeV3 } from "@/app/features/search/services/friend-code-v3";
import type {
  ContactRequestRecord,
  DeliveryStatusToastPayload,
  DiscoveryIntent,
  DiscoveryResult,
  PublicDiscoveryProfile,
  ResolveResult,
  ResolvedIdentity
} from "@/app/features/search/types/discovery";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import { getScopedStorageKey } from "@/app/features/profiles/services/profile-scope";
import { useEnhancedDMController } from "@/app/features/messaging/controllers/enhanced-dm-controller";
import { InvitationComposerDialog } from "@/app/features/messaging/components/invitation-composer-dialog";
import {
  buildInvitationRequestMessage,
  DEFAULT_INVITATION_INTRO,
  type InvitationComposerValues,
} from "@/app/features/messaging/services/invitation-composer";
import {
  getDirectInvitationStatusCopy,
  getDirectInvitationToastCopy,
  getInvitationOutboxStatusCopy,
  type InvitationTone,
} from "@/app/features/messaging/services/invitation-presentation";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { getV090RolloutPolicy } from "@/app/features/settings/services/v090-rollout-policy";
import { normalizePublicUrl } from "@/app/shared/public-url";
import type { RelayReadinessState } from "@/app/features/relays/services/relay-recovery-policy";

type DiscoverySurface = "global" | "add_friend" | "communities";
type DirectRequestPhase = "idle" | "sending" | "ok" | "partial" | "queued" | "failed" | "unsupported";

const getRecentSearchesStorageKey = (): string => getScopedStorageKey("recent_searches");
const LEGACY_RECENT_SEARCHES_STORAGE_KEY = "recent_searches";
const REQUEST_SEND_TIMEOUT_MS = 15_000;

const mapSurfaceToIntent = (surface: DiscoverySurface): DiscoveryIntent => {
  if (surface === "global") return "search_people";
  if (surface === "communities") return "search_communities";
  return "add_friend";
};

const isDeterministicDirectQuery = (
  value: string,
  options?: Readonly<{ allowLegacyInviteCode?: boolean }>
): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (parsePublicKeyInput(trimmed).ok) return true;
  if (Boolean(extractContactCardFromQuery(trimmed))) return true;
  if (options?.allowLegacyInviteCode !== false && isValidInviteCode(trimmed.toUpperCase())) return true;
  return false;
};

const statusLabelFromReason = (reason: string | undefined): string | null => {
  switch (reason) {
    case "relay_degraded":
      return "Relay network is degraded. Showing partial results.";
    case "offline":
      return "Offline mode: only cached and local results are available.";
    case "no_match":
      return "No matching results found.";
    case "unsupported_token":
      return "Use deterministic add tokens: QR, contact card, Friend Code, npub, or pubkey.";
    case "invalid_code":
      return "Invalid code format. Ask for a new code, QR, or contact link.";
    case "expired_code":
      return "Code expired. Ask for a new short code.";
    case "code_used":
      return "Code already used. Ask for a new short code.";
    case "legacy_code_unresolvable":
      return "Legacy code could not be resolved. Ask for QR/contact link/Friend Code.";
    case "index_unavailable_fallback":
      return "Index unavailable and relay fallback degraded. Use QR/contact card/npub.";
    case "index_unavailable":
      return "Optional index service is unavailable.";
    default:
      return null;
  }
};

const relaySearchStatusCopy = (readiness: RelayReadinessState): string | null => {
  switch (readiness) {
    case "recovering":
      return "Obscur is rebuilding relay connections. Search is using direct, cached, and index results first.";
    case "degraded":
      return "Relay connections are degraded. Search may return partial results while recovery continues.";
    case "offline":
      return "No relay connection is available. Search is limited to direct, cached, and local results.";
    default:
      return null;
  }
};

const sourceStatusLabel = (state: string): string => {
  if (state === "running") return "running";
  if (state === "success") return "ok";
  if (state === "error") return "error";
  if (state === "timeout") return "timeout";
  if (state === "skipped") return "skipped";
  return "idle";
};

const invitationToneClassName = (tone: InvitationTone): string => {
  if (tone === "success") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (tone === "warning") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (tone === "danger") return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  if (tone === "info") return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
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
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const resolveStableIdentity = (input: string): ResolveResult => {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, reason: "invalid_input", message: "Input is required." };
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
    message: "Use a contact card, npub, or hex pubkey for Add Friend.",
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
    } catch {
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
  } catch {
    npub = undefined;
  }
  return {
    id: `resolved:${identity.pubkey}`,
    kind: "person",
    title: identity.display || "Unknown contact",
    subtitle: identity.source.replace("_", " "),
    pubkey: identity.pubkey,
    npub,
    confidence: identity.confidence,
    sources: ["local"],
  };
};

const getProfileInitials = (input: string | null | undefined): string => {
  const normalized = (input || "").trim();
  if (!normalized) return "??";
  const segments = normalized.split(/\s+/).filter(Boolean);
  if (segments.length >= 2) {
    return `${segments[0][0] || ""}${segments[1][0] || ""}`.toUpperCase();
  }
  return normalized.slice(0, 2).toUpperCase();
};

const compactKey = (value: string | undefined, leading = 16, trailing = 12): string => {
  if (!value) return "";
  if (value.length <= leading + trailing + 3) return value;
  return `${value.slice(0, leading)}...${value.slice(-trailing)}`;
};

const isLikelyNip05Identifier = (value: string | undefined): boolean => {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
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
  const [diagnosticsTick, setDiagnosticsTick] = useState(0);
  const resolvedMetadata = useResolvedProfileMetadata(resolvedIdentity?.pubkey ?? null);
  const isResolvedIdentitySelf = Boolean(resolvedIdentity && publicKeyHex && resolvedIdentity.pubkey === publicKeyHex);
  const navigateToProfile = React.useCallback((targetPubkey: string): void => {
    if (publicKeyHex && targetPubkey === publicKeyHex) {
      router.push("/settings#profile");
      return;
    }
    router.push(getPublicProfileHref(targetPubkey));
  }, [publicKeyHex, router]);

  const buildResolvedPreviewProfile = React.useCallback((identity: ResolvedIdentity): PublicDiscoveryProfile => {
    const base = mapResolvedIdentityToPublicDiscoveryProfile(identity);
    const isSelf = Boolean(publicKeyHex && identity.pubkey === publicKeyHex);
    const localUsername = profile.state.profile.username.trim();
    const localAbout = (profile.state.profile.about || "").trim();
    const localNip05 = (profile.state.profile.nip05 || "").trim();
    const localAvatar = normalizePublicUrl(profile.state.profile.avatarUrl);

    return {
      ...base,
      title: resolvedMetadata?.displayName || identity.display || (isSelf ? localUsername : "") || "Unknown contact",
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
  ]);

  const {
    results,
    isSearching,
    queryState,
    error,
    search,
    clearResults,
  } = useGlobalSearch({
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
    enableAutoQueueProcessing: false,
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
    if (!publicKeyHex) return "";
    try {
      return nip19.npubEncode(publicKeyHex);
    } catch {
      return "";
    }
  }, [publicKeyHex]);

  const resolveSafeInput = React.useCallback(async (input: string): Promise<ResolveResult> => {
    const trimmed = input.trim();
    const normalized = trimmed.toUpperCase();
    if (isValidInviteCode(normalized)) {
      if (!allowLegacyInviteCode) {
        return {
          ok: false,
          reason: "unsupported_token",
          message: "Invite code lookup is disabled. Use QR/contact card/Friend Code/npub.",
        };
      }
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
        message: "Invite code could not be resolved. Ask for QR/contact link/npub.",
      };
    }
    return resolveStableIdentity(trimmed);
  }, [allowLegacyInviteCode, inviteResolver]);

  const lastSearchedRef = useRef("");

  useEffect(() => {
    const saved = localStorage.getItem(getRecentSearchesStorageKey()) ?? localStorage.getItem(LEGACY_RECENT_SEARCHES_STORAGE_KEY);
    if (!saved) {
      setRecentSearches([]);
      return;
    }
    try {
      setRecentSearches(JSON.parse(saved));
    } catch {
      setRecentSearches([]);
    }
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
    if (!initialQuery || initialQuery === lastSearchedRef.current) return;
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
        } else {
          setResolvedIdentity(null);
          setResolverMessage(resolved.message);
        }
        clearResults();
      });
    } else {
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
    let cancelled = false;
    void createSignedContactCard({
      pubkey: publicKeyHex,
      privateKeyHex,
      relays: enabledRelayUrls,
      label: profile.state.profile.username || undefined,
      inviteCode: profile.state.profile.inviteCode || undefined,
    }).then((card) => {
      if (cancelled) return;
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
    return () => {
      cancelled = true;
    };
  }, [publicKeyHex, privateKeyHex, enabledRelayUrls, profile.state.profile.username, profile.state.profile.inviteCode]);

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
          message: "Delivered to quorum relays.",
          relaySuccessCount: record.publishReport?.successCount,
          relayTotal: record.publishReport?.totalRelays,
        });
      } else if (record.status === "sent_partial") {
        const successCount = record.publishReport?.successCount ?? 0;
        const totalRelays = record.publishReport?.totalRelays ?? 0;
        emitDeliveryToast({
          status: "sent_partial",
          message: `Partially delivered (${successCount}/${totalRelays || "?"}).`,
          relaySuccessCount: successCount,
          relayTotal: totalRelays,
        });
      } else if (record.status === "failed") {
        if (record.nextRetryAtUnixMs && record.nextRetryAtUnixMs > Date.now()) {
          emitDeliveryToast({
            status: "queued_retrying",
            message: "Request queued; retrying automatically.",
            retryAtUnixMs: record.nextRetryAtUnixMs,
          });
        } else {
          emitDeliveryToast({
            status: "failed",
            message: record.error || "Connection request failed.",
          });
        }
      }
    }
    outboxStatusMapRef.current = next;
  }, [requestOutbox.state.records]);

  const addToRecent = (searchTerm: string): void => {
    if (!searchTerm.trim()) return;
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
    if (!trimmed) return;
    const isRepeatDeterministicSearch = (
      isDeterministicDirectQuery(trimmed, { allowLegacyInviteCode })
      && trimmed === lastSearchedRef.current
      && (!!resolvedIdentity || filteredResults.length > 0)
    );
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
        } else {
          setResolvedIdentity(null);
          setResolverMessage(resolved.message);
        }
        clearResults();
      });
    } else {
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
    if (!discoveryFeatureFlags.suggestionsV1) {
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
    peerTrust.state.acceptedPeers,
    publicKeyHex,
    requestsInbox.state.items,
  ]);

  const reasonLabel = statusLabelFromReason(queryState.reasonCode);
  const relaySearchLabel = relaySearchStatusCopy(relayRecovery.readiness);
  const hasDeterministicQuery = isDeterministicDirectQuery(query, { allowLegacyInviteCode });
  const showResolvedState = (
    surface === "add_friend"
    && (
      hasDeterministicQuery
      || Boolean(resolvedIdentity)
      || Boolean(resolverMessage)
      || identityResolver.phase === "resolving"
    )
  );
  void diagnosticsTick;
  const discoveryDiagnosticsSnapshot = discoverySessionDiagnosticsStore.getSnapshot();

  const copyText = async (value: string, successLabel: string): Promise<void> => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successLabel);
    } catch {
      toast.error("Unable to copy");
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
    setDirectRequestMessage("Obscur is trying to deliver your invitation.");
    try {
      const report = await withTimeout(
        requestTransport.sendRequest({
          peerPublicKeyHex: target.pubkey as PublicKeyHex,
          introMessage: buildInvitationRequestMessage(values),
        }),
        REQUEST_SEND_TIMEOUT_MS,
        "Request timed out. Relay quality is degraded; please retry."
      );

      if (report.status === "ok") {
        setDirectRequestPhase("ok");
        setDirectRequestMessage("Invitation delivered.");
        toast.success(getDirectInvitationToastCopy("ok").message);
        return true;
      }

      if (report.status === "partial") {
        setDirectRequestPhase("partial");
        setDirectRequestMessage("Invitation reached part of the network.");
        toast.warning(getDirectInvitationToastCopy("partial", {
          relaySuccessCount: report.relaySuccessCount,
          relayTotal: report.relayTotal,
        }).message);
        return true;
      }

      if (report.status === "queued") {
        setDirectRequestPhase("queued");
        setDirectRequestMessage(report.message || "Delivery is waiting for a healthier relay connection.");
        toast.warning(getDirectInvitationToastCopy("queued", {
          message: report.message,
        }).message);
        return true;
      }

      setDirectRequestPhase(report.status);
      setDirectRequestMessage(report.message || "Obscur could not confirm delivery.");
      toast.error(getDirectInvitationToastCopy(report.status, {
        message: report.message,
      }).message);
      return false;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Obscur could not confirm delivery.";
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

  return (
    <PageShell title={t("search.title", "Discovery")} navBadgeCounts={navBadges.navBadgeCounts} hideHeader>
      <div className="flex h-full flex-col bg-background">
        <div className="sticky top-0 z-30 border-b border-border/50 bg-background/90 px-4 py-4 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-5xl">
            <div className="flex items-start justify-between gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="h-10 w-10 rounded-full"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex-1">
                <div className="rounded-[36px] border border-black/10 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.24),_transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(244,247,255,0.9))] px-5 py-6 shadow-[0_28px_80px_rgba(15,23,42,0.16)] dark:border-border/60 dark:bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_48%),linear-gradient(180deg,rgba(10,16,34,0.76),rgba(6,10,22,0.92))] dark:shadow-[0_28px_80px_rgba(0,0,0,0.22)]">
                  <div className="mx-auto max-w-3xl text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-600 dark:text-zinc-400">Discovery</p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight text-zinc-950 dark:text-zinc-100 sm:text-4xl">One search box for your network</h1>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 sm:text-base">
                      Find people and communities, then open their public profile or switch to direct add when you already have a private contact token.
                    </p>
                  </div>

                  <form onSubmit={handleSearch} className="mx-auto mt-6 flex w-full max-w-3xl items-center gap-3 rounded-[28px] border border-black/10 bg-white/85 px-4 py-3 shadow-[0_12px_40px_rgba(15,23,42,0.14)] dark:border-border/60 dark:bg-background/80 dark:shadow-[0_12px_40px_rgba(0,0,0,0.18)]">
                    <SearchIcon className="h-4 w-4 text-zinc-500 dark:text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={
                        surface === "add_friend"
                          ? (
                            deterministicDiscoveryEnabled
                              ? (
                                  allowLegacyInviteCode
                                    ? "Paste a contact card, short code, invite code, npub, or pubkey"
                                    : "Paste a contact card, short code, npub, or pubkey"
                                )
                              : (
                                  allowLegacyInviteCode
                                    ? "Paste a contact card, invite code, npub, or pubkey"
                                    : "Paste a contact card, npub, or pubkey"
                                )
                          )
                          : surface === "communities"
                            ? "Search communities by name or relay'group"
                            : "Search people, communities, npubs, nip-05 handles, or public keys"
                      }
                      className="h-12 flex-1 border-none bg-transparent p-0 text-base focus-visible:ring-0"
                    />
                    <Button
                      type="submit"
                      disabled={isSearching || !query.trim()}
                      className="h-11 rounded-2xl px-5 font-bold"
                    >
                      {surface === "add_friend" && deterministicDiscoveryEnabled
                        ? (identityResolver.phase === "resolving" ? "Resolving..." : "Resolve")
                        : (isSearching ? "Searching..." : "Search")}
                    </Button>
                    {query && (
                      <Button type="button" variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={clearSearch}>
                        <SearchX className="h-4 w-4" />
                      </Button>
                    )}
                  </form>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2 overflow-x-auto">
            {(["global", "add_friend", "communities"] as DiscoverySurface[]).map((target) => (
              <button
                key={target}
                onClick={() => {
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
                        } else {
                          setResolvedIdentity(null);
                          setResolverMessage(resolved.message);
                        }
                      });
                    } else {
                      void search(query, mapSurfaceToIntent(target));
                    }
                  }
                }}
                className={cn(
                  "h-10 rounded-full border px-4 text-[11px] font-black uppercase tracking-[0.16em] transition-colors",
                  surface === target
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                )}
              >
                {target === "global" ? "Everything" : target === "add_friend" ? "Add Friend" : "Communities"}
              </button>
            ))}
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-zinc-600 dark:text-muted-foreground">
                    <span className="rounded-full border border-border/60 px-3 py-1">
                      {surface === "add_friend"
                        ? (stabilityModeEnabled ? "Safe mode" : (deterministicDiscoveryEnabled ? "Deterministic add" : "Direct resolve"))
                        : `Search ${queryState.phase}`}
                    </span>
                    {surface === "global" && (
                      <>
                        <span className="rounded-full border border-border/60 px-3 py-1">People</span>
                        <span className="rounded-full border border-border/60 px-3 py-1">Communities</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 pb-24">
          {surface === "add_friend" && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Direct Add</p>
                      <div className="rounded-full border border-border px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        {deterministicDiscoveryEnabled ? identityResolver.phase : "ready"}
                      </div>
                      {stabilityModeEnabled && (
                        <div className="rounded-full border border-blue-500/30 bg-blue-500/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                          Safe mode
                        </div>
                      )}
                    </div>
                    <h3 className="mt-3 text-2xl font-black tracking-tight">Resolve one exact account</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                      {allowLegacyInviteCode
                        ? "Paste a contact card, invite code, npub, or public key. Obscur should resolve one exact person here, not bury you under a fuzzy discovery list."
                        : "Paste a contact card, npub, or public key. Obscur should resolve one exact person here, not bury you under a fuzzy discovery list."}
                    </p>
                  </div>

                  <Button onClick={() => setShareDialogOpen(true)} className="shrink-0">
                    <QrCode className="mr-2 h-4 w-4" />
                    Show My Contact
                  </Button>
                </div>
              </div>

              <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Discovery Diagnostics</p>
                    <h3 className="mt-2 text-lg font-black tracking-tight">Rollout visibility</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Local diagnostics for discovery lookup quality and conversion events in this session.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      discoverySessionDiagnosticsStore.clear();
                      setDiagnosticsTick((prev) => prev + 1);
                    }}
                  >
                    Clear
                  </Button>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-xs">
                    Lookups: <span className="font-semibold">{discoveryDiagnosticsSnapshot.lookupCount}</span>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-xs">
                    Conversions: <span className="font-semibold">{discoveryDiagnosticsSnapshot.addConversionCount}</span>
                  </div>
                  <div className="rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-xs">
                    Last source: <span className="font-semibold">{discoveryDiagnosticsSnapshot.lastLookup?.primaryMatchSource ?? "none"}</span>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
                  <span className={cn(
                    "rounded-full border px-3 py-1",
                    discoveryFeatureFlags.inviteCodeV1 ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-300" : "border-border text-muted-foreground"
                  )}>
                    invite-code:{discoveryFeatureFlags.inviteCodeV1 ? "on" : "off"}
                  </span>
                  <span className={cn(
                    "rounded-full border px-3 py-1",
                    discoveryFeatureFlags.deepLinkV1 ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-300" : "border-border text-muted-foreground"
                  )}>
                    deep-link:{discoveryFeatureFlags.deepLinkV1 ? "on" : "off"}
                  </span>
                  <span className={cn(
                    "rounded-full border px-3 py-1",
                    discoveryFeatureFlags.suggestionsV1 ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-300" : "border-border text-muted-foreground"
                  )}>
                    suggestions:{discoveryFeatureFlags.suggestionsV1 ? "on" : "off"}
                  </span>
                </div>
                {discoveryDiagnosticsSnapshot.lastLookup ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Last lookup: {discoveryDiagnosticsSnapshot.lastLookup.latencyMs ?? 0} ms, {discoveryDiagnosticsSnapshot.lastLookup.resultCount} result(s), phase {discoveryDiagnosticsSnapshot.lastLookup.phase}.
                  </p>
                ) : null}
              </div>

              <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Exact Match</p>
                    <h3 className="mt-2 text-lg font-black tracking-tight">Use this person or reject the token</h3>
                  </div>
                  {resolverMessage ? (
                    <div className="max-w-sm rounded-2xl border border-border/50 bg-background/50 px-4 py-2 text-right text-xs text-muted-foreground">
                      {resolverMessage}
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 space-y-3">
                  {resolvedIdentity ? (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => navigateToProfile(resolvedIdentity.pubkey)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          navigateToProfile(resolvedIdentity.pubkey);
                        }
                      }}
                      className="cursor-pointer rounded-[28px] border border-emerald-500/30 bg-emerald-500/5 p-5 transition-colors hover:border-emerald-500/50 hover:bg-emerald-500/10"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex min-w-0 items-center gap-4">
                          <Avatar className="h-16 w-16 border border-emerald-500/30">
                          <AvatarImage
                            src={resolvedMetadata?.avatarUrl || (isResolvedIdentitySelf ? profile.state.profile.avatarUrl : undefined)}
                            alt={resolvedMetadata?.displayName || resolvedIdentity.display || resolvedIdentity.pubkey}
                            className="object-cover"
                          />
                          <AvatarFallback className="font-black">
                            {getProfileInitials(resolvedMetadata?.displayName || resolvedIdentity.display || "Unknown contact")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-lg font-black text-foreground">
                            {resolvedMetadata?.displayName || resolvedIdentity.display || "Unknown contact"}
                          </p>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {resolvedMetadata?.nip05 || resolvedIdentity.source.replace("_", " ")}
                          </p>
                          {resolvedMetadata?.about ? (
                            <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-muted-foreground">
                              {resolvedMetadata.about}
                            </p>
                          ) : null}
                        </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <Button
                            size="sm"
                            disabled={directRequestPhase === "sending"}
                            onClick={(event) => {
                              event.stopPropagation();
                              openInvitationDialog(resolvedIdentity);
                            }}
                          >
                            {directRequestPhase === "sending" ? "Sending Invitation..." : "Send Invitation"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigateToProfile(resolvedIdentity.pubkey);
                            }}
                          >
                            View Profile
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              void copyText(resolvedIdentity.pubkey, "Pubkey copied");
                            }}
                          >
                            Copy Pubkey
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-border/50 bg-background/40 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Public Key</p>
                          <p className="mt-1 break-all font-mono text-xs text-foreground">{resolvedIdentity.pubkey}</p>
                        </div>
                        <div className="rounded-2xl border border-border/50 bg-background/40 px-4 py-3">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Resolver Source</p>
                          <p className="mt-1 text-sm font-semibold text-foreground">{resolvedIdentity.source.replace("_", " ")}</p>
                        </div>
                      </div>

                      {!deterministicDiscoveryEnabled && directRequestMessage ? (
                        (() => {
                          const invitationStatus = getDirectInvitationStatusCopy(directRequestPhase, {
                            message: directRequestMessage,
                          });
                          if (!invitationStatus) {
                            return null;
                          }
                          return (
                            <div className={cn("mt-3 rounded-2xl border px-3 py-3", invitationToneClassName(invitationStatus.tone))}>
                              <p className="text-[10px] font-black uppercase tracking-[0.18em]">{invitationStatus.badge}</p>
                              <p className="mt-1 text-sm font-semibold">{invitationStatus.title}</p>
                              <p className="mt-1 text-xs leading-relaxed opacity-90">{invitationStatus.detail}</p>
                            </div>
                          );
                        })()
                      ) : null}
                    </div>
                  ) : showResolvedState ? (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-5 py-6">
                      <p className="text-sm font-semibold text-foreground">
                        {identityResolver.phase === "resolving" ? "Resolving token..." : "No exact account resolved"}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {identityResolver.phase === "resolving"
                          ? "Obscur is resolving the token against deterministic identity paths."
                          : (
                              resolverMessage || (
                                allowLegacyInviteCode
                                  ? "Paste a contact card, invite code, npub, or public key in the search bar above."
                                  : "Paste a contact card, npub, or public key in the search bar above."
                              )
                            )}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/70 bg-background/30 px-5 py-6 text-center">
                      <p className="text-sm font-semibold text-foreground">No contact loaded yet</p>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {allowLegacyInviteCode
                          ? "Paste a contact card, invite code, npub, or public key and the exact account will appear here."
                          : "Paste a contact card, npub, or public key and the exact account will appear here."}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {deterministicDiscoveryEnabled && requestOutbox.state.records.length > 0 && (
                <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.16em]">Invitation Delivery</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        This timeline shows what Obscur has actually confirmed so far.
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => requestOutbox.clearTerminal()}>
                      Clear Done
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {requestOutbox.state.records.slice(0, 6).map((record) => (
                      <div key={record.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/20 px-3 py-3">
                        <div className="min-w-0 flex-1">
                          {(() => {
                            const invitationStatus = getInvitationOutboxStatusCopy(record);
                            return (
                              <>
                                <div className={cn("inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em]", invitationToneClassName(invitationStatus.tone))}>
                                  {invitationStatus.badge}
                                </div>
                                <p className="mt-2 text-sm font-semibold text-foreground">{invitationStatus.title}</p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{invitationStatus.detail}</p>
                              </>
                            );
                          })()}
                          <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{record.peerPubkey}</p>
                          {record.publishReport && (
                            <p className="text-[11px] text-muted-foreground">
                              Relay confirmations: {record.publishReport.successCount}/{record.publishReport.totalRelays}
                            </p>
                          )}
                          {record.error && (
                            <p className="truncate text-[11px] text-rose-600 dark:text-rose-300">{record.error}</p>
                          )}
                        </div>
                        {record.status === "failed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!!record.blockReason && record.blockReason !== "cooldown_active"}
                            onClick={() => requestOutbox.retryNow(record.id)}
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {discoveryFeatureFlags.suggestionsV1 && !query.trim() && !resolvedIdentity && friendSuggestions.length > 0 && (
                <div className="rounded-3xl border border-border/60 bg-card/70 p-5">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-[0.16em]">Friend Suggestions</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Local suggestions from recent identity metadata. Nothing new is published when viewing this list.
                      </p>
                    </div>
                    <span className="rounded-full border border-border/60 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                      local cache
                    </span>
                  </div>
                  <div className="space-y-2">
                    {friendSuggestions.map((suggestion) => (
                      <div key={suggestion.pubkey} className="flex items-center justify-between gap-3 rounded-2xl border border-border/50 bg-muted/20 px-3 py-3">
                        <div className="min-w-0 flex items-center gap-3">
                          <Avatar className="h-10 w-10 border border-border/60">
                            <AvatarImage src={suggestion.picture} alt={suggestion.displayName} className="object-cover" />
                            <AvatarFallback className="font-black">
                              {getProfileInitials(suggestion.displayName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{suggestion.displayName}</p>
                            <p className="truncate text-xs text-muted-foreground">{suggestion.subtitle || "Identity hidden"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setQuery(suggestion.pubkey);
                              setResolvedIdentity({
                                pubkey: suggestion.pubkey as PublicKeyHex,
                                display: suggestion.displayName,
                                inviteCode: suggestion.inviteCode,
                                source: "hex",
                                confidence: "cached_only",
                              });
                              setResolverMessage("Resolved via local suggestion cache");
                            }}
                          >
                            Use
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigateToProfile(suggestion.pubkey)}
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {surface !== "add_friend" && relaySearchLabel && (
            <div className={cn(
              "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
              relayRecovery.readiness === "offline"
                ? "border-rose-500/20 bg-rose-500/5 text-rose-700 dark:text-rose-300"
                : relayRecovery.readiness === "recovering"
                  ? "border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            )}>
              {relayRecovery.readiness === "offline" ? (
                <WifiOff className="mt-0.5 h-4 w-4" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4" />
              )}
              <div>
                <p>{relaySearchLabel}</p>
              </div>
            </div>
          )}

          {surface !== "add_friend" && (reasonLabel || error) && (
            <div className={cn(
              "flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
              queryState.reasonCode === "offline"
                ? "border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
            )}>
              {queryState.reasonCode === "offline" ? (
                <WifiOff className="mt-0.5 h-4 w-4" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4" />
              )}
              <div>
                <p>{reasonLabel || error}</p>
              </div>
            </div>
          )}

          {surface !== "add_friend" && (
            <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Source Status</span>
            {(["local", "relay", "index"] as const).map((source) => (
              <span
                key={source}
                className={cn(
                  "rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest",
                  queryState.sourceStatusMap[source].state === "success" ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-300" :
                    queryState.sourceStatusMap[source].state === "running" ? "border-blue-500/30 text-blue-600 dark:text-blue-300" :
                      queryState.sourceStatusMap[source].state === "error" ? "border-rose-500/30 text-rose-600 dark:text-rose-300" :
                        "border-border text-muted-foreground"
                )}
              >
                {source}:{sourceStatusLabel(queryState.sourceStatusMap[source].state)}
              </span>
            ))}
            </div>
          )}

          {surface !== "add_friend" && !query && recentSearches.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                <History className="h-4 w-4" />
                Recent Searches
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {recentSearches.map((entry) => (
                  <button
                    key={entry}
                    onClick={() => {
                      setQuery(entry);
                      void search(entry, mapSurfaceToIntent(surface));
                    }}
                    className="rounded-2xl border border-border/50 bg-card/60 px-4 py-3 text-left text-sm font-medium hover:border-primary/30"
                  >
                    {entry}
                  </button>
                ))}
              </div>
            </div>
          )}

          {surface !== "add_friend" && query && filteredResults.length > 0 && (
            <div className="space-y-3">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                {isSearching ? "Searching..." : `${filteredResults.length} result${filteredResults.length === 1 ? "" : "s"}`}
              </div>
              <div className="flex flex-col gap-3">
                {filteredResults.map((result) => (
                  <SearchResultCard
                    key={result.canonicalId}
                    result={result}
                    onClick={(entry) => {
                      if ((entry.kind === "person" || entry.kind === "invite" || entry.kind === "contact_card") && entry.display.pubkey) {
                        navigateToProfile(entry.display.pubkey);
                        return;
                      }
                      if (entry.kind === "community" && entry.display.communityId) {
                        router.push(getPublicGroupHref(entry.display.communityId, entry.display.relayUrl));
                      }
                    }}
                    onAdd={(entry) => {
                      if (!entry.display.pubkey) return;
                      setSurface("add_friend");
                      setQuery(entry.display.pubkey);
                      const identity: ResolvedIdentity = {
                        pubkey: entry.display.pubkey,
                        display: entry.display.title,
                        source: "hex",
                        confidence: entry.confidence === "direct" ? "direct" : "relay_confirmed",
                      };
                      setResolvedIdentity(identity);
                      setResolverMessage("Resolved via public preview");
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {surface !== "add_friend" && query && !isSearching && filteredResults.length === 0 && (
            <div className="flex min-h-[35vh] flex-col items-center justify-center rounded-3xl border border-dashed border-border/70 bg-card/40 p-8 text-center">
              <SearchX className="mb-4 h-9 w-9 text-muted-foreground/60" />
              <h4 className="text-lg font-black">No Results</h4>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Try a name, a nip-05 handle, an npub, a public key, or a community identifier like <code>relay.example'group</code>.
              </p>
            </div>
          )}

          {surface !== "add_friend" && !query && recentSearches.length === 0 && (
            <div className="flex min-h-[35vh] flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/40 p-8 text-center">
              <UserPlus className="mb-4 h-10 w-10 text-primary/70" />
              <h4 className="text-xl font-black">Start with a global search</h4>
              <p className="mt-2 max-w-lg text-sm text-muted-foreground">
                Look up people and communities from one place, then open a profile, send an invitation, or switch to direct add when someone shares a private contact token.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <span className="rounded-full border border-border px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">People</span>
                <span className="rounded-full border border-border px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Communities</span>
                <span className="rounded-full border border-border px-3 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Direct add when needed</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {previewProfile && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onClick={() => setPreviewProfile(null)}
        >
          <div
            className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-background/95 via-background/90 to-background/95 p-5 shadow-2xl shadow-black/30"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
            </div>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {previewProfile.kind === "person" ? (
                  <Avatar className="h-14 w-14 border border-border/70">
                    <AvatarImage src={previewProfile.picture} alt={previewProfile.title} className="object-cover" />
                    <AvatarFallback className="font-black">
                      {getProfileInitials(previewProfile.title)}
                    </AvatarFallback>
                  </Avatar>
                ) : null}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                    {previewProfile.kind === "community" ? "Public Community Preview" : "Public Profile Preview"}
                  </p>
                  <h3 className="mt-1 text-2xl font-black">{previewProfile.title}</h3>
                  {previewProfile.subtitle ? (
                    <p className="text-sm text-muted-foreground">{previewProfile.subtitle}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                    <span className="rounded-full border border-border px-2 py-1 text-muted-foreground">
                      confidence: {previewProfile.confidence}
                    </span>
                    <span className="rounded-full border border-border px-2 py-1 text-muted-foreground">
                      sources: {previewProfile.sources.join(", ")}
                    </span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPreviewProfile(null)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative space-y-3 rounded-2xl border border-border/60 bg-card/55 p-4 text-sm backdrop-blur-sm">
              {previewProfile.kind === "person" ? (
                <ProfileCompletenessIndicator
                  hasAvatar={!!(previewProfile.picture || (previewProfile.pubkey && publicKeyHex && previewProfile.pubkey === publicKeyHex && profile.state.profile.avatarUrl))}
                  hasUsername={previewProfile.title.trim().length > 0}
                  hasDescription={!!previewProfile.description?.trim()}
                  hasNip05={isLikelyNip05Identifier(previewProfile.subtitle)}
                />
              ) : null}
              {previewProfile.description ? (
                <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">About</p>
                  <p className="mt-1 text-muted-foreground">{previewProfile.description}</p>
                </div>
              ) : null}
              {previewProfile.pubkey ? (
                <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Public Key</p>
                  <p className="mt-1 break-all font-mono text-xs">{previewProfile.pubkey}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Short: {compactKey(previewProfile.pubkey)}</p>
                </div>
              ) : null}
              {previewProfile.npub ? (
                <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Npub</p>
                  <p className="mt-1 break-all font-mono text-xs">{previewProfile.npub}</p>
                </div>
              ) : null}
              {previewProfile.communityId ? (
                <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Community</p>
                  <p className="mt-1 break-all font-mono text-xs">{previewProfile.communityId}</p>
                </div>
              ) : null}
              {previewProfile.relayUrl ? (
                <div className="rounded-xl border border-border/60 bg-background/60 p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Declared Relay</p>
                  <p className="mt-1 break-all font-mono text-xs">{previewProfile.relayUrl}</p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 md:justify-start">
              {previewProfile.pubkey ? (
                <>
                  <Button
                    className="bg-gradient-to-r from-indigo-500 to-blue-500 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-400 hover:to-blue-400"
                    onClick={() => void copyText(previewProfile.pubkey || "", "Pubkey copied")}
                  >
                    Copy Contact
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border/70 bg-background/50"
                    onClick={() => {
                      if (!previewProfile.pubkey) return;
                      const target: ResolvedIdentity = {
                        pubkey: previewProfile.pubkey,
                        display: previewProfile.title,
                        source: "hex",
                        confidence: previewProfile.confidence === "direct" ? "direct" : "relay_confirmed",
                      };
                      setSurface("add_friend");
                      setQuery(previewProfile.pubkey);
                      setResolvedIdentity(target);
                      setResolverMessage("Resolved via public preview");
                      setPreviewProfile(null);
                      openInvitationDialog(target);
                    }}
                  >
                    Send Invitation
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border/70 bg-background/50"
                    onClick={() => {
                      if (!previewProfile.pubkey) return;
                      setSurface("add_friend");
                      setQuery(previewProfile.pubkey);
                      setResolvedIdentity({
                        pubkey: previewProfile.pubkey,
                        display: previewProfile.title,
                        source: "hex",
                        confidence: previewProfile.confidence === "direct" ? "direct" : "relay_confirmed",
                      });
                      setResolverMessage("Resolved via public preview");
                      setPreviewProfile(null);
                    }}
                  >
                    Open In Add Friend
                  </Button>
                </>
              ) : null}
              {previewProfile.kind === "community" && previewProfile.communityId ? (
                <Button
                  variant="outline"
                  className="border-border/70 bg-background/50"
                  onClick={() => {
                    const communityId = previewProfile.communityId;
                    if (!communityId) return;
                    router.push(getPublicGroupHref(communityId, previewProfile.relayUrl ?? undefined));
                  }}
                >
                  Open Full Public Profile
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      )}
      <InvitationComposerDialog
        isOpen={Boolean(invitationDialogTarget)}
        recipientName={
          invitationDialogTarget
            ? (resolvedMetadata?.displayName || invitationDialogTarget.display || "Unknown contact")
            : "this person"
        }
        recipientPubkey={invitationDialogTarget?.pubkey || ""}
        submitLabel={deterministicDiscoveryEnabled ? "Queue Invitation" : "Send Invitation"}
        deliveryHint={
          deterministicDiscoveryEnabled
            ? "Obscur will queue this invitation if relays are not ready yet, and the delivery timeline below will show confirmed progress."
            : "Obscur will only mark this invitation as delivered after relay evidence comes back."
        }
        defaults={{
          intro: requestIntroText,
          note: requestNoteText,
          secretCode: requestSecretCode,
        }}
        onClose={() => setInvitationDialogTarget(null)}
        onSubmit={handleInvitationDialogSubmit}
      />
      {shareDialogOpen && (
        <div className="fixed inset-0 z-[130] bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShareDialogOpen(false)}>
          <div
            className="mx-auto mt-10 w-full max-w-4xl rounded-3xl border border-border/70 bg-background/95 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Private Share Surface</p>
                <h3 className="mt-1 text-xl font-black">Share My Contact</h3>
                <p className="mt-1 text-sm text-muted-foreground">Use short code, contact link/card, npub/pubkey, or QR.</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShareDialogOpen(false)} className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4">
                {deterministicDiscoveryEnabled ? (
                  <>
                    <div className="rounded-2xl border border-border/50 bg-muted/40 p-3 font-mono text-xs break-all">
                      {friendCodeV3 || "Short code unavailable"}
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 text-[11px] text-muted-foreground">
                      Expires: {friendCodeV3ExpiryUnixMs ? new Date(friendCodeV3ExpiryUnixMs).toLocaleTimeString() : "n/a"}
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 font-mono text-xs break-all text-muted-foreground">
                      Compatibility code: {friendCodeV2 || "none"}
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 font-mono text-xs break-all text-muted-foreground">
                      Legacy alias: {profile.state.profile.inviteCode || "none"}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-2xl border border-border/50 bg-muted/30 p-3 font-mono text-xs break-all">
                      {profile.state.profile.inviteCode || "Invite code unavailable"}
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/40 p-3 font-mono text-xs break-all">
                      {myNpub || "npub unavailable"}
                    </div>
                    <div className="rounded-2xl border border-border/50 bg-muted/20 p-3 font-mono text-xs break-all text-muted-foreground">
                      {publicKeyHex || "pubkey unavailable"}
                    </div>
                  </>
                )}
                <div className="flex flex-wrap gap-2">
                  {deterministicDiscoveryEnabled ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => void copyText(friendCodeV2, "Friend Code copied")}>
                        <Copy className="mr-1 h-3 w-3" />
                        Copy Compatibility Code
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void copyText(friendCodeV3, "Short code copied")}>
                        <Copy className="mr-1 h-3 w-3" />
                        Copy Short Code
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void copyText(profile.state.profile.inviteCode ?? "", "Legacy code copied")}>
                        <Copy className="mr-1 h-3 w-3" />
                        Copy Legacy Alias
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={() => void copyText(profile.state.profile.inviteCode ?? "", "Invite code copied")}>
                        <Copy className="mr-1 h-3 w-3" />
                        Copy Invite Code
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void copyText(myNpub, "npub copied")}>
                        <Copy className="mr-1 h-3 w-3" />
                        Copy npub
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => void copyText(publicKeyHex ?? "", "Pubkey copied")}>
                        <Copy className="mr-1 h-3 w-3" />
                        Copy Pubkey
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={() => void copyText(shareLink, "Contact link copied")}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy Link
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void copyText(shareCardEncoded, "Contact card copied")}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy Card
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-[0.16em]">QR Contact</h3>
                </div>
                {shareQrDataUrl ? (
                  <img src={shareQrDataUrl} alt="Contact QR" className="h-52 w-52 rounded-2xl border border-border/50 bg-white p-3" />
                ) : (
                  <div className="flex h-52 w-52 items-center justify-center rounded-2xl border border-dashed border-border/70 text-xs text-muted-foreground">
                    QR unavailable
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
