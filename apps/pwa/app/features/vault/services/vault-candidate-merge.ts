import type { VaultMediaCandidate } from "./vault-media-aggregator";

const candidateKey = (candidate: VaultMediaCandidate): string => (
  `${candidate.msg.id}:${candidate.attachmentIndex}:${candidate.attachment.url}`
);

export const mergeVaultMediaCandidates = (
  existing: ReadonlyArray<VaultMediaCandidate>,
  incoming: ReadonlyArray<VaultMediaCandidate>,
): VaultMediaCandidate[] => {
  if (incoming.length === 0) {
    return [...existing];
  }
  const seen = new Set(existing.map(candidateKey));
  const merged = [...existing];
  for (const candidate of incoming) {
    const key = candidateKey(candidate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(candidate);
  }
  return merged;
};
