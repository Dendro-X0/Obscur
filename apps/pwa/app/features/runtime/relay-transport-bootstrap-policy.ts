"use client";

import { isSecondaryProfileWindow } from "./services/secondary-profile-post-login-refresh-policy";

/** Delay relay WebSocket connect until local shell is interactive (ms). */
export const RELAY_TRANSPORT_BOOTSTRAP_DELAY_MS = 1_500;

/** Longer relay bootstrap delay for secondary profile windows to avoid startup pile-up. */
export const RELAY_TRANSPORT_BOOTSTRAP_DELAY_SECONDARY_MS = 5_000;

/** Minimum interval between relay runtime supervisor refreshes driven by pool ticks (ms). */
export const RELAY_RUNTIME_REFRESH_MIN_INTERVAL_MS = 1_000;

export const resolveRelayTransportBootstrapDelayMs = (profileId: string): number => (
  isSecondaryProfileWindow(profileId)
    ? RELAY_TRANSPORT_BOOTSTRAP_DELAY_SECONDARY_MS
    : RELAY_TRANSPORT_BOOTSTRAP_DELAY_MS
);
