import type {
  DiscoveryIdentity,
  DiscoveryMatchSource,
  DiscoveryResult,
  DiscoverySource,
  DiscoveryVerificationStatus,
} from "@/app/features/search/types/discovery";

const inferVerificationStatus = (result: DiscoveryResult): DiscoveryVerificationStatus => {
  if (result.kind === "contact_card") {
    const isVerifiedDescription = (result.display.description ?? "").toLowerCase().includes("verified");
    return isVerifiedDescription ? "verified" : "unknown";
  }
  if (result.confidence === "direct" || result.confidence === "relay_confirmed") {
    return "verified";
  }
  return "unknown";
};

export const resolvePrimaryDiscoverySource = (sources: ReadonlyArray<DiscoverySource>): DiscoveryMatchSource => {
  if (sources.length === 0) {
    return "none";
  }
  if (sources.length > 1) {
    return "mixed";
  }
  return sources[0] ?? "none";
};

export const toDiscoveryIdentity = (result: DiscoveryResult): DiscoveryIdentity | null => {
  const pubkey = result.display.pubkey?.trim();
  if (!pubkey) {
    return null;
  }
  return {
    canonicalId: result.canonicalId,
    pubkey,
    inviteCode: result.display.inviteCode,
    displayName: result.display.title,
    subtitle: result.display.subtitle,
    avatarUrl: result.display.picture,
    about: result.display.description,
    verification: {
      confidence: result.confidence,
      status: inferVerificationStatus(result),
    },
    provenance: {
      primarySource: resolvePrimaryDiscoverySource(result.sources),
      sources: result.sources,
    },
  };
};
