"use client";

import React from "react";
import type { ManagedWorkspaceRelayGate } from "../../services/community-mode-contract";
import { isManagedWorkspaceRelayGateBlocking } from "../../services/community-mode-contract";

export function ManagedWorkspaceRelayGateBanner({
    gate,
    className,
}: Readonly<{
    gate: ManagedWorkspaceRelayGate;
    className?: string;
}>): React.JSX.Element | null {
    if (!isManagedWorkspaceRelayGateBlocking(gate)) {
        return null;
    }

    return (
        <p
            className={className ?? "rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"}
            role="status"
        >
            {gate.userMessage}
            {" "}
            {gate.settingsHint}
        </p>
    );
}
