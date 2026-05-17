type SearchJumpMessage = Readonly<{
  id: string;
  eventId?: string;
  timestamp: Date;
}>;

export type SearchJumpStep =
  | Readonly<{
    kind: "found_by_id";
    targetMessageIndex: number;
    resolvedMessageId: string;
  }>
  | Readonly<{
    kind: "load_earlier_for_timestamp";
  }>
  | Readonly<{
    kind: "timestamp_fallback";
    targetMessageIndex: number;
    resolvedMessageId: string;
  }>
  | Readonly<{
    kind: "load_earlier_for_id";
  }>
  | Readonly<{
    kind: "unresolved";
    reasonCode: "target_not_found_in_current_window" | "target_not_found_after_load_attempts";
  }>;

export const resolveSearchJumpStep = (params: Readonly<{
  messages: ReadonlyArray<SearchJumpMessage>;
  jumpToMessageId: string;
  jumpToMessageTimestampMs: number | null;
  loadAttemptCount: number;
  maxLoadAttempts: number;
}>): SearchJumpStep => {
  const targetMessageIndex = params.messages.findIndex((message) => (
    message.id === params.jumpToMessageId
    || message.eventId === params.jumpToMessageId
  ));
  if (targetMessageIndex >= 0) {
    return {
      kind: "found_by_id",
      targetMessageIndex,
      resolvedMessageId: params.messages[targetMessageIndex]?.id ?? params.jumpToMessageId,
    };
  }

  if (params.jumpToMessageTimestampMs !== null && params.messages.length > 0) {
    const earliestTimestampMs = params.messages[0]?.timestamp.getTime();
    if (
      Number.isFinite(earliestTimestampMs)
      && params.jumpToMessageTimestampMs < earliestTimestampMs
      && params.loadAttemptCount < params.maxLoadAttempts
    ) {
      return { kind: "load_earlier_for_timestamp" };
    }

    const fallbackIndex = params.messages.findIndex((message) => (
      message.timestamp.getTime() >= params.jumpToMessageTimestampMs!
    ));
    const resolvedIndex = fallbackIndex >= 0 ? fallbackIndex : Math.max(0, params.messages.length - 1);
    return {
      kind: "timestamp_fallback",
      targetMessageIndex: resolvedIndex,
      resolvedMessageId: params.messages[resolvedIndex]?.id ?? "unknown",
    };
  }

  if (params.loadAttemptCount < params.maxLoadAttempts) {
    return { kind: "load_earlier_for_id" };
  }

  return {
    kind: "unresolved",
    reasonCode: params.loadAttemptCount === 0
      ? "target_not_found_in_current_window"
      : "target_not_found_after_load_attempts",
  };
};

export type SearchJumpDomResolution = "resolved" | "retry" | "unresolved";

export const resolveSearchJumpDomResolution = (params: Readonly<{
  targetElement: HTMLElement | null;
  renderResolveAttemptCount: number;
  maxRenderResolveAttempts: number;
}>): SearchJumpDomResolution => {
  if (params.targetElement) {
    return "resolved";
  }
  if (params.renderResolveAttemptCount < params.maxRenderResolveAttempts) {
    return "retry";
  }
  return "unresolved";
};
