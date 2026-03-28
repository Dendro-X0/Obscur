export const VOICE_INVITE_TOMBSTONE_GRACE_MS = 1_000;

const toFiniteUnixMs = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.floor(value);
};

export type VoiceInviteTombstoneVerdict = Readonly<{
  tombstoned: boolean;
  leftAtUnixMs: number | null;
  invitedAtUnixMs: number | null;
}>;

export const resolveVoiceInviteTombstoneVerdict = (params: Readonly<{
  leftAtUnixMs: number | null | undefined;
  invitedAtUnixMs: number | null | undefined;
}>): VoiceInviteTombstoneVerdict => {
  const leftAtUnixMs = toFiniteUnixMs(params.leftAtUnixMs);
  const invitedAtUnixMs = toFiniteUnixMs(params.invitedAtUnixMs);
  if (leftAtUnixMs === null) {
    return {
      tombstoned: false,
      leftAtUnixMs: null,
      invitedAtUnixMs,
    };
  }
  const tombstoned = invitedAtUnixMs === null
    ? true
    : leftAtUnixMs >= invitedAtUnixMs - VOICE_INVITE_TOMBSTONE_GRACE_MS;
  return {
    tombstoned,
    leftAtUnixMs,
    invitedAtUnixMs,
  };
};
