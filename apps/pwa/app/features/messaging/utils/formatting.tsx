
import React from "react";

const ONE_MINUTE_MS: number = 60_000;
const ONE_HOUR_MS: number = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS: number = 24 * ONE_HOUR_MS;

export const formatTime = (date: Date, currentNowMs: number | null): string => {
    if (currentNowMs === null) {
        return "";
    }
    const diff: number = currentNowMs - date.getTime();

    // Handle future timestamps (clock sync issues)
    if (diff < 0) {
        return "Just now";
    }

    if (diff < ONE_HOUR_MS) {
        return `${Math.floor(diff / ONE_MINUTE_MS)}m ago`;
    }
    if (diff < ONE_DAY_MS) {
        return `${Math.floor(diff / ONE_HOUR_MS)}h ago`;
    }
    return `${Math.floor(diff / ONE_DAY_MS)}d ago`;
};

export const highlightText = (params: Readonly<{ text: string; query: string }>): React.ReactNode => {
    const query: string = params.query.trim();
    if (query.length === 0) {
        return params.text;
    }
    const lowerText: string = params.text.toLowerCase();
    const lowerQuery: string = query.toLowerCase();
    const parts: React.ReactNode[] = [];
    let cursor: number = 0;
    while (cursor < params.text.length) {
        const index: number = lowerText.indexOf(lowerQuery, cursor);
        if (index < 0) {
            parts.push(params.text.slice(cursor));
            break;
        }
        if (index > cursor) {
            parts.push(params.text.slice(cursor, index));
        }
        const matchEnd: number = index + query.length;
        parts.push(
            <mark key={`${index}-${matchEnd}`} className = "rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/30" >
                { params.text.slice(index, matchEnd) }
                </mark>
    );
cursor = matchEnd;
  }
return React.createElement(React.Fragment, null, parts);
};
