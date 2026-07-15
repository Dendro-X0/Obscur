/** TRUST-INT-1d — recipient-local metadata signals (no body NLP). */

export const WOT_TRUSTED_MAX_DEPTH_V1 = 1;

export const ATTACHMENT_REPEAT_HASH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export const ATTACHMENT_REPEAT_HASH_PEER_THRESHOLD = 3;

const CAS_BLOB_HASH_PATTERN = /\/blob\/([a-f0-9]{64})/i;

const normalizePeerKey = (peerPublicKeyHex: string): string => peerPublicKeyHex.trim().toLowerCase();

const normalizeContentDigest = (contentDigestHex: string): string => contentDigestHex.trim().toLowerCase();

/**
 * v1 WoT depth: direct accepted peers are distance 1; everyone else is outside the web (null).
 * Multi-hop vouch graph is future work — null means unreachable from accepted roots.
 */
export const resolvePeerWotDistanceV1 = (
  peerPublicKeyHex: string,
  isPeerAccepted: boolean,
): number | null => (isPeerAccepted ? WOT_TRUSTED_MAX_DEPTH_V1 : null);

export const shouldTriggerGraphWotDistanceSignal = (
  peerWotDistance: number | null | undefined,
): boolean => peerWotDistance == null;

/** Extract CAS ciphertext digest from relay attachment URLs; skips blob/local URLs. */
export const extractAttachmentContentDigestFromUrl = (rawUrl: string): string | null => {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("blob:")) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    const match = parsed.pathname.match(CAS_BLOB_HASH_PATTERN);
    return match?.[1] ? normalizeContentDigest(match[1]) : null;
  } catch {
    return null;
  }
};

export const resolveAttachmentContentDigestsFromUrls = (
  attachmentUrls: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const digests = new Set<string>();
  for (const url of attachmentUrls) {
    const digest = extractAttachmentContentDigestFromUrl(url);
    if (digest) {
      digests.add(digest);
    }
  }
  return Array.from(digests);
};

export const shouldTriggerAttachmentRepeatHashSignal = (
  distinctPeerCount: number,
  threshold: number = ATTACHMENT_REPEAT_HASH_PEER_THRESHOLD,
): boolean => distinctPeerCount >= threshold;

export const normalizeAttachmentFanoutPeerKey = normalizePeerKey;

export const normalizeAttachmentFanoutDigest = normalizeContentDigest;
