export type SmokeSignOffDecision = "PASS" | "BLOCKED" | "MISSING";

/** Parses W54 sign-off markdown for maintainer decision. */
export const parseSmokeSignOffDecision = (content: string): SmokeSignOffDecision => {
  if (/\*\*Decision:\*\*\s*PASS\b/.test(content)) {
    return "PASS";
  }
  if (/\*\*Decision:\*\*\s*BLOCKED\b/.test(content)) {
    return "BLOCKED";
  }
  return "MISSING";
};

const isStandaloneLegacyDeletionEnvApproved = (): boolean => (
  typeof process !== "undefined"
  && process.env.NEXT_PUBLIC_OBSCUR_TRANSPORT_STANDALONE_LEGACY_DELETION_APPROVED === "1"
);

/** W56: deletion approved only when sign-off is PASS and maintainer env is set. */
export const isStandaloneLegacyDeletionApproved = (
  signOffMarkdown: string,
): boolean => (
  parseSmokeSignOffDecision(signOffMarkdown) === "PASS"
  && isStandaloneLegacyDeletionEnvApproved()
);

/** Env mirror for contract tests. */
export const isStandaloneLegacyDeletionEnvApprovedForPolicy = (): boolean => (
  isStandaloneLegacyDeletionEnvApproved()
);
