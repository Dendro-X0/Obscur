const STRUCTURED_DM_PAYLOAD_TYPES = new Set<string>([
  "community-invite",
  "community-invite-response",
]);

/**
 * Account projection stores `plaintextPreview` as the hydrated DM row `content`.
 * Structured control payloads must stay intact (room keys, metadata, reply ids).
 * Ordinary chat text may clip for sidebar previews elsewhere.
 */
export const toAccountEventPlaintextPreview = (value: string): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  try {
    const parsed = JSON.parse(normalized) as { type?: unknown };
    if (typeof parsed?.type === "string" && STRUCTURED_DM_PAYLOAD_TYPES.has(parsed.type)) {
      return normalized;
    }
  } catch {
    // Non-JSON chat text uses the clip path below.
  }

  if (normalized.length <= 140) {
    return normalized;
  }
  return `${normalized.slice(0, 140)}...`;
};
