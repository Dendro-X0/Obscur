export const FIRST_LOGIN_HISTORY_SYNC_NOTICE_MIN_VISIBLE_MS = 60_000;

export const shouldStartFirstLoginHistorySyncNoticeHold = (params: Readonly<{
  isIdentityUnlocked: boolean;
  showInitialHistorySyncNotice: boolean;
  hasVisibleConversations: boolean;
  accountPublicKeyHex: string | null;
  hasSeenFirstLoginNotice: boolean;
}>): boolean => {
  return (
    params.isIdentityUnlocked
    && params.showInitialHistorySyncNotice
    && !params.hasVisibleConversations
    && typeof params.accountPublicKeyHex === "string"
    && params.accountPublicKeyHex.trim().length > 0
    && !params.hasSeenFirstLoginNotice
  );
};

export const resolveHistorySyncNoticeVisible = (params: Readonly<{
  policyVisible: boolean;
  holdVisibleUntilUnixMs: number | null;
  nowUnixMs: number;
}>): boolean => {
  if (params.policyVisible) {
    return true;
  }
  if (typeof params.holdVisibleUntilUnixMs !== "number") {
    return false;
  }
  return params.nowUnixMs < params.holdVisibleUntilUnixMs;
};

