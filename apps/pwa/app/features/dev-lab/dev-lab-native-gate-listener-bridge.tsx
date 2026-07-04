"use client";

import { useEffect, useRef } from "react";
import { isDevLabEnabled } from "./dev-lab-policy";
import {
  isNativeGateCompleted,
  NATIVE_GATE_LISTENER_URL,
  postNativeGateReport,
  probeNativeGateListener,
  readNativeGatePending,
  resumeNativeGateAfterReload,
  runDevLabNativeGate,
} from "./dev-lab-native-gate";

const LISTENER_POLL_MS = 5_000;
const MAX_LISTENER_PING_FAILURES = 3;

/**
 * When `pnpm dev:lab:native-gate` is listening on :9876, auto-runs native gate in Tauri
 * (no CDP / WebView2 remote debugging required).
 */
export const DevLabNativeGateListenerBridge = (): null => {
  const startedRef = useRef(false);
  const pingFailuresRef = useRef(0);

  useEffect(() => {
    if (!isDevLabEnabled() || startedRef.current) {
      return;
    }

    let cancelled = false;

    const run = async (): Promise<void> => {
      const lab = window.obscurDevLab;
      const unlock = lab?.unlock;
      if (!unlock) {
        return;
      }

      const pending = readNativeGatePending();
      if (pending) {
        startedRef.current = true;
        const report = await resumeNativeGateAfterReload(pending, unlock);
        await postNativeGateReport(report, pending.listenerUrl);
        return;
      }

      if (isNativeGateCompleted()) {
        return;
      }

      const shellUnlocked = lab?.probeShellHealth?.().shellUnlocked === true;
      if (!shellUnlocked) {
        return;
      }

      if (pingFailuresRef.current >= MAX_LISTENER_PING_FAILURES) {
        return;
      }

      const listenerAlive = await probeNativeGateListener(NATIVE_GATE_LISTENER_URL);
      if (!listenerAlive) {
        pingFailuresRef.current += 1;
        return;
      }
      pingFailuresRef.current = 0;

      if (cancelled) {
        return;
      }

      const messagingStatus = lab?.getMessagingStatus?.() ?? null;
      if (messagingStatus !== "ready") {
        return;
      }

      startedRef.current = true;
      const report = await runDevLabNativeGate(unlock, {
        listenerUrl: NATIVE_GATE_LISTENER_URL,
      });
      if (readNativeGatePending()) {
        return;
      }
      await postNativeGateReport(report, NATIVE_GATE_LISTENER_URL);
    };

    const intervalId = window.setInterval(() => {
      void run().catch((error) => {
        console.error("[DevLab] native gate failed:", error);
      });
    }, LISTENER_POLL_MS);

    void run().catch((error) => {
      console.error("[DevLab] native gate failed:", error);
    });

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return null;
};
