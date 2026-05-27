"use client";

/** Delay relay WebSocket connect until local shell is interactive (ms). */
export const RELAY_TRANSPORT_BOOTSTRAP_DELAY_MS = 2_500;

/** Minimum interval between relay runtime supervisor refreshes driven by pool ticks (ms). */
export const RELAY_RUNTIME_REFRESH_MIN_INTERVAL_MS = 1_000;
