import type { RuntimeLogClassification } from "@/app/shared/runtime-log-classification";

export type DecryptFailureReason =
  | "expected_foreign_or_malformed"
  | "relay_scope_mismatch"
  | "transient"
  | "regression";

export type DecryptFailureClassification = Readonly<{
  reason: DecryptFailureReason;
  runtimeClass: RuntimeLogClassification;
  shouldSurfaceToUser: boolean;
}>;

const includesOneOf = (haystack: string, needles: ReadonlyArray<string>): boolean =>
  needles.some((needle) => haystack.includes(needle));

export const classifyDecryptFailure = (error: unknown): DecryptFailureClassification => {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  if (
    includesOneOf(message, [
      "unpad error",
      "invalid padding",
      "malformed",
      "invalid base64",
      "wrong final block length",
      "bad decrypt",
      "could not decrypt",
      "invalid ciphertext",
    ])
  ) {
    return {
      reason: "expected_foreign_or_malformed",
      runtimeClass: "expected",
      shouldSurfaceToUser: false,
    };
  }

  if (includesOneOf(message, ["relay_scope_mismatch", "scope mismatch"])) {
    return {
      reason: "relay_scope_mismatch",
      runtimeClass: "degraded",
      shouldSurfaceToUser: false,
    };
  }

  if (
    includesOneOf(message, [
      "timeout",
      "temporar",
      "network",
      "econn",
      "reset by peer",
    ])
  ) {
    return {
      reason: "transient",
      runtimeClass: "degraded",
      shouldSurfaceToUser: false,
    };
  }

  return {
    reason: "regression",
    runtimeClass: "actionable",
    shouldSurfaceToUser: true,
  };
};

