export type AuthResultStatus =
  | "ok"
  | "locked"
  | "failed"
  | "unsupported"
  | "mismatch";

export type AuthReasonCode =
  | "invalid_input"
  | "invalid_passphrase"
  | "identity_mismatch"
  | "keychain_unavailable"
  | "keychain_missing"
  | "keychain_persist_failed"
  | "profile_scope_unresolved"
  | "session_inactive"
  | "sybil_rejected"
  | "unsupported_runtime"
  | "storage_unavailable";

export type AuthResult<T> = Readonly<{
  status: AuthResultStatus;
  value?: T;
  reasonCode?: AuthReasonCode;
  message?: string;
}>;

export const authOk = <T>(value: T): AuthResult<T> => ({
  status: "ok",
  value,
});

export const authFailed = (params: Readonly<{
  reasonCode: AuthReasonCode;
  message?: string;
}>): AuthResult<never> => ({
  status: "failed",
  reasonCode: params.reasonCode,
  ...(params.message ? { message: params.message } : {}),
});
