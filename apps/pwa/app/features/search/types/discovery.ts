export type DiscoveryIntent =
  | "add_friend"
  | "search_people"
  | "search_communities"
  | "resolve_invite"
  | "resolve_card";

export type DiscoveryEntityKind = "person" | "community" | "contact_card" | "invite";

export type DiscoverySource = "local" | "relay" | "index";

export type DiscoveryConfidence = "direct" | "relay_confirmed" | "cached_only";
export type DiscoveryMatchSource = DiscoverySource | "mixed" | "none";
export type DiscoveryVerificationStatus = "verified" | "unverified" | "unknown";

export type DiscoveryPhase = "idle" | "running" | "partial" | "complete" | "timeout" | "offline" | "degraded";

export type DiscoveryReasonCode =
  | "invalid_input"
  | "invalid_code"
  | "expired_code"
  | "code_used"
  | "unsupported_token"
  | "legacy_code_unresolvable"
  | "no_match"
  | "offline"
  | "relay_degraded"
  | "index_unavailable"
  | "index_unavailable_fallback"
  | "canceled";

export type DiscoverySourceStatus = Readonly<{
  state: "idle" | "running" | "success" | "error" | "timeout" | "skipped";
  message?: string;
  elapsedMs?: number;
}>;

export type DiscoveryDisplayPayload = Readonly<{
  title: string;
  subtitle?: string;
  description?: string;
  picture?: string;
  pubkey?: string;
  communityId?: string;
  relayUrl?: string;
  inviteCode?: string;
  contactCardRaw?: string;
}>;

export type DiscoveryResult = Readonly<{
  canonicalId: string;
  kind: DiscoveryEntityKind;
  display: DiscoveryDisplayPayload;
  confidence: DiscoveryConfidence;
  sources: ReadonlyArray<DiscoverySource>;
  score: number;
  freshnessUnixMs: number;
}>;

export type DiscoveryIdentity = Readonly<{
  canonicalId: string;
  pubkey: string;
  npub?: string;
  inviteCode?: string;
  displayName?: string;
  subtitle?: string;
  avatarUrl?: string;
  about?: string;
  verification: Readonly<{
    confidence: DiscoveryConfidence;
    status: DiscoveryVerificationStatus;
  }>;
  provenance: Readonly<{
    primarySource: DiscoveryMatchSource;
    sources: ReadonlyArray<DiscoverySource>;
  }>;
}>;

export type DiscoveryQueryState = Readonly<{
  intent: DiscoveryIntent;
  query: string;
  phase: DiscoveryPhase;
  reasonCode?: DiscoveryReasonCode;
  elapsedMs: number;
  sourceStatusMap: Readonly<Record<DiscoverySource, DiscoverySourceStatus>>;
}>;

export type ContactCardV1 = Readonly<{
  version: 1;
  pubkey: string;
  relays: ReadonlyArray<string>;
  label?: string;
  inviteCode?: string;
  issuedAt: number;
  expiresAt: number;
  sig?: string;
}>;

export type ResolvedIdentity = Readonly<{
  pubkey: string;
  display?: string;
  relays?: ReadonlyArray<string>;
  inviteCode?: string;
  source: ResolverInputKind;
  confidence: DiscoveryConfidence;
}>;

export type ResolverInputKind =
  | "contact_card"
  | "friend_code_v3"
  | "friend_code_v2"
  | "npub"
  | "hex"
  | "legacy_code"
  | "text";

export type ResolveResult =
  | Readonly<{ ok: true; identity: ResolvedIdentity }>
  | Readonly<{ ok: false; reason: DiscoveryReasonCode; message: string }>;

export type FriendCodeV2Payload = Readonly<{
  version: 2;
  pubkey: string;
  relays?: ReadonlyArray<string>;
}>;

export type FriendCodeDecodeResult =
  | Readonly<{ ok: true; payload: FriendCodeV2Payload }>
  | Readonly<{ ok: false; reason: "invalid_prefix" | "invalid_payload" | "checksum_mismatch" | "invalid_pubkey" }>;

export type FriendCodeV3Payload = Readonly<{
  version: 3;
  pubkey: string;
  relays?: ReadonlyArray<string>;
  issuedAt: number;
  expiresAt: number;
  singleUse?: boolean;
}>;

export type FriendCodeV3DecodeResult =
  | Readonly<{ ok: true; codeId: string; payload: FriendCodeV3Payload }>
  | Readonly<{ ok: false; reason: "invalid_prefix" | "invalid_payload" | "checksum_mismatch" | "invalid_pubkey" | "expired_code" | "code_used" }>;

export type ContactRequestStatus =
  | "draft"
  | "queued"
  | "publishing"
  | "sent_partial"
  | "sent_quorum"
  | "accepted"
  | "rejected"
  | "expired"
  | "failed";

export type ContactRequestPublishReport = Readonly<{
  successCount: number;
  totalRelays: number;
  metQuorum: boolean;
  failures: ReadonlyArray<Readonly<{ relayUrl: string; error?: string }>>;
}>;

export type ContactRequestRecord = Readonly<{
  id: string;
  peerPubkey: string;
  introMessage?: string;
  status: ContactRequestStatus;
  retries: number;
  nextRetryAtUnixMs?: number;
  createdAtUnixMs: number;
  updatedAtUnixMs: number;
  publishReport?: ContactRequestPublishReport;
  error?: string;
  failureReason?: string;
  blockReason?: string;
}>;

export type PublicDiscoveryProfile = Readonly<{
  id: string;
  kind: "person" | "community";
  title: string;
  subtitle?: string;
  description?: string;
  picture?: string;
  pubkey?: string;
  npub?: string;
  communityId?: string;
  relayUrl?: string;
  confidence: DiscoveryConfidence;
  sources: ReadonlyArray<DiscoverySource>;
}>;

export type RelaySendSnapshot = Readonly<{
  atUnixMs: number;
  writableRelayUrls: ReadonlyArray<string>;
  openRelayCount: number;
}>;

export type DeliveryStatusToastPayload = Readonly<{
  status: "sent_quorum" | "sent_partial" | "queued_retrying" | "failed";
  message: string;
  relaySuccessCount?: number;
  relayTotal?: number;
  retryAtUnixMs?: number;
}>;
