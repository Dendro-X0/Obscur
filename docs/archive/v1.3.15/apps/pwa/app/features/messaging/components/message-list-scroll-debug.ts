import type { MessageListScrollMetrics } from "./message-list-scroll";

export type MessageListScrollDebugEvent = Readonly<{
    atUnixMs: number;
    name: string;
    context: Readonly<Record<string, unknown>>;
}>;

export type MessageListScrollTimelineEntry = Readonly<{
    atUnixMs: number;
    offsetMs: number;
    name: string;
    reasonCode: string | null;
    behavior: string | null;
    followBottom: boolean | null;
    userAwayFromBottom: boolean | null;
    metrics: MessageListScrollMetrics | null;
}>;

const resolveFiniteNumber = (value: unknown): number | null => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return null;
    }
    return Math.floor(value);
};

const resolveBoolean = (value: unknown): boolean | null => {
    if (typeof value !== "boolean") {
        return null;
    }
    return value;
};

const resolveString = (value: unknown): string | null => {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const resolveMetrics = (value: unknown): MessageListScrollMetrics | null => {
    if (!value || typeof value !== "object") {
        return null;
    }
    const candidate = value as Record<string, unknown>;
    const scrollTop = resolveFiniteNumber(candidate.scrollTop);
    const scrollHeight = resolveFiniteNumber(candidate.scrollHeight);
    const clientHeight = resolveFiniteNumber(candidate.clientHeight);
    if (scrollTop === null || scrollHeight === null || clientHeight === null) {
        return null;
    }
    return { scrollTop, scrollHeight, clientHeight };
};

export const buildMessageListScrollTimeline = (
    events: ReadonlyArray<MessageListScrollDebugEvent>,
    limit = 200,
): ReadonlyArray<MessageListScrollTimelineEntry> => {
    const boundedLimit = Math.max(1, Math.floor(limit));
    const selected = events.slice(-boundedLimit);
    const firstAtUnixMs = selected[0]?.atUnixMs;
    if (typeof firstAtUnixMs !== "number" || !Number.isFinite(firstAtUnixMs)) {
        return [];
    }
    return selected.map((event) => {
        const context = event.context ?? {};
        return {
            atUnixMs: event.atUnixMs,
            offsetMs: Math.max(0, Math.floor(event.atUnixMs - firstAtUnixMs)),
            name: event.name,
            reasonCode: resolveString(context.reasonCode),
            behavior: resolveString(context.behavior),
            followBottom: resolveBoolean(context.followBottom),
            userAwayFromBottom: resolveBoolean(context.userAwayFromBottom),
            metrics: resolveMetrics(context.metrics),
        };
    });
};

export const collectMessageListScrollFollowTransitions = (
    timeline: ReadonlyArray<MessageListScrollTimelineEntry>,
): ReadonlyArray<MessageListScrollTimelineEntry> => {
    let previous: boolean | null = null;
    return timeline.filter((entry) => {
        if (entry.followBottom === null) {
            return false;
        }
        if (previous === null) {
            previous = entry.followBottom;
            return true;
        }
        if (previous === entry.followBottom) {
            return false;
        }
        previous = entry.followBottom;
        return true;
    });
};

export const collectMessageListScrollReasonTimeline = (
    timeline: ReadonlyArray<MessageListScrollTimelineEntry>,
): ReadonlyArray<MessageListScrollTimelineEntry> => {
    return timeline.filter((entry) => entry.reasonCode !== null);
};

export const findFirstMessageListNonManualBottomRequest = (
    timeline: ReadonlyArray<MessageListScrollTimelineEntry>,
): MessageListScrollTimelineEntry | null => {
    for (const entry of timeline) {
        if (entry.name !== "scroll_to_bottom_requested") {
            continue;
        }
        if (entry.reasonCode === "manual_button") {
            continue;
        }
        if (entry.behavior !== null && entry.behavior !== "auto") {
            continue;
        }
        return entry;
    }
    return null;
};

const formatBoolean = (value: boolean | null): string => {
    if (value === null) {
        return "-";
    }
    return value ? "true" : "false";
};

const formatMetrics = (metrics: MessageListScrollMetrics | null): string => {
    if (!metrics) {
        return "top=-,height=-,view=-";
    }
    return `top=${metrics.scrollTop},height=${metrics.scrollHeight},view=${metrics.clientHeight}`;
};

export const formatMessageListScrollTimeline = (
    timeline: ReadonlyArray<MessageListScrollTimelineEntry>,
): string => {
    if (timeline.length === 0) {
        return "No message-list scroll debug events captured.";
    }
    const followTransitions = collectMessageListScrollFollowTransitions(timeline);
    const lines: Array<string> = [];
    lines.push(`Message-list scroll timeline (${timeline.length} events)`);
    lines.push(`Follow transitions: ${followTransitions.length}`);
    const firstNonManualBottomRequest = findFirstMessageListNonManualBottomRequest(timeline);
    lines.push(
        `First non-manual bottom request: ${firstNonManualBottomRequest ? `${firstNonManualBottomRequest.reasonCode ?? "unknown"} @ +${firstNonManualBottomRequest.offsetMs}ms` : "none"}`,
    );
    for (const entry of timeline) {
        const offset = String(entry.offsetMs).padStart(6, " ");
        const reason = entry.reasonCode ?? "-";
        const behavior = entry.behavior ?? "-";
        const triggerLabel = firstNonManualBottomRequest === entry ? " trigger=true" : "";
        lines.push(
            `[+${offset}ms] ${entry.name} reason=${reason} behavior=${behavior} follow=${formatBoolean(entry.followBottom)} away=${formatBoolean(entry.userAwayFromBottom)} ${formatMetrics(entry.metrics)}${triggerLabel}`,
        );
    }
    return lines.join("\n");
};
