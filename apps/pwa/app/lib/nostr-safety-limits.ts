type NostrSafetyLimits = Readonly<{
  maxDmPlaintextChars: number;
}>;

const NOSTR_SAFETY_LIMITS: NostrSafetyLimits = {
  maxDmPlaintextChars: 4000,
};

export { NOSTR_SAFETY_LIMITS };
