export type MediaErrorReasonCode =
  | "cache_unsupported"
  | "network"
  | "decode"
  | "not_found"
  | "unknown";

export type MediaErrorState = Readonly<{
  recoverable: boolean;
  reasonCode: MediaErrorReasonCode;
  canRetry: boolean;
  canOpenExternal: boolean;
  hint: string;
}>;

const includesOneOf = (message: string, needles: ReadonlyArray<string>): boolean =>
  needles.some((needle) => message.includes(needle));

export const classifyMediaError = (error: unknown): MediaErrorState => {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.toLowerCase();

  if (includesOneOf(message, ["err_cache_operation_not_supported", "cache_operation_not_supported"])) {
    return {
      recoverable: true,
      reasonCode: "cache_unsupported",
      canRetry: true,
      canOpenExternal: true,
      hint: "Cache playback is unsupported in this runtime. Retrying with bypass may work.",
    };
  }

  if (includesOneOf(message, ["404", "not found"])) {
    return {
      recoverable: false,
      reasonCode: "not_found",
      canRetry: false,
      canOpenExternal: true,
      hint: "The media URL is unavailable.",
    };
  }

  if (includesOneOf(message, ["network", "timeout", "failed to fetch", "econn"])) {
    return {
      recoverable: true,
      reasonCode: "network",
      canRetry: true,
      canOpenExternal: true,
      hint: "Network error while loading media.",
    };
  }

  if (includesOneOf(message, ["decode", "mediaerror", "codec", "demux"])) {
    return {
      recoverable: false,
      reasonCode: "decode",
      canRetry: true,
      canOpenExternal: true,
      hint: "This media format may not be supported by the current player.",
    };
  }

  return {
    recoverable: true,
    reasonCode: "unknown",
    canRetry: true,
    canOpenExternal: true,
    hint: "Media failed to load.",
  };
};

