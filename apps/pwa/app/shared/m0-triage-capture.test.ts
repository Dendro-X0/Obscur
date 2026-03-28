import { beforeEach, describe, expect, it, vi } from "vitest";
import { installM0TriageCapture, m0TriageCaptureInternals } from "./m0-triage-capture";

type MutableWindow = Window & Record<string, unknown>;

const getMutableWindow = (): MutableWindow => window as unknown as MutableWindow;

describe("m0-triage-capture", () => {
  beforeEach(() => {
    const root = getMutableWindow();
    delete root.obscurM0Triage;
    delete root.obscurWindowRuntime;
    delete root.obscurRelayRuntime;
    delete root.obscurRelayTransportJournal;
    delete root.obscurUiResponsiveness;
    delete root.obscurRouteMountDiagnostics;
    delete root.obscurAppEvents;
    vi.restoreAllMocks();
  });

  it("installs a global capture helper and returns required baseline snapshots", () => {
    const root = getMutableWindow();
    root.obscurWindowRuntime = {
      getSnapshot: () => ({ phase: "ready" }),
    };
    root.obscurRelayRuntime = {
      getSnapshot: () => ({ phase: "healthy", writableRelayCount: 2 }),
    };
    root.obscurRelayTransportJournal = {
      getSnapshot: () => ({ pendingOutboundBySource: { dm_queue: 0 } }),
    };
    root.obscurUiResponsiveness = {
      getSnapshot: () => ({ droppedFrameCount: 1 }),
    };
    root.obscurRouteMountDiagnostics = {
      getSnapshot: () => ({ recentSamples: [{ pathname: "/", elapsedMs: 40 }] }),
    };
    root.obscurAppEvents = {
      getDigest: () => ({ total: 12 }),
      getCrossDeviceSyncDigest: () => ({ totalBufferedEvents: 16 }),
      findByName: () => [],
    };

    installM0TriageCapture();

    const api = root.obscurM0Triage as {
      capture: (eventWindowSize?: number) => unknown;
      captureJson: (eventWindowSize?: number) => string;
    };
    expect(api).toBeTruthy();

    const bundle = api.capture(200) as {
      checks: { requiredApis: Record<string, boolean> };
      snapshots: Record<string, unknown>;
      events: Record<string, unknown>;
    };
    expect(bundle.checks.requiredApis.windowRuntime).toBe(true);
    expect(bundle.checks.requiredApis.relayRuntime).toBe(true);
    expect(bundle.checks.requiredApis.relayTransportJournal).toBe(true);
    expect(bundle.checks.requiredApis.appEvents).toBe(true);
    expect(bundle.snapshots.windowRuntime).toEqual({ phase: "ready" });
    expect(bundle.snapshots.relayRuntime).toEqual({ phase: "healthy", writableRelayCount: 2 });
    expect(bundle.snapshots.relayTransportJournal).toEqual({ pendingOutboundBySource: { dm_queue: 0 } });
    expect(bundle.snapshots.routeMountDiagnostics).toEqual({ recentSamples: [{ pathname: "/", elapsedMs: 40 }] });
    expect(bundle.events.digest).toEqual({ total: 12 });
    expect(bundle.events.crossDeviceDigest).toEqual({ totalBufferedEvents: 16 });
    expect(() => JSON.parse(api.captureJson(200))).not.toThrow();
  });

  it("captures focused event groups for startup/navigation/sync/media triage", () => {
    const root = getMutableWindow();
    const findByName = vi.fn((name: string) => {
      if (name === "runtime.profile_boot_stall_timeout") {
        return [{ name, atUnixMs: 1, level: "warn" }];
      }
      if (
        name === "runtime.profile_binding_refresh_timeout"
        || name === "runtime.activation.profile_scope_mismatch"
        || name === "auth.auto_unlock_scope_drift_detected"
      ) {
        return [{ name, atUnixMs: 5, level: "warn" }];
      }
      if (name === "navigation.route_stall_hard_fallback" || name === "navigation.route_mount_probe_slow") {
        return [{ name, atUnixMs: 2, level: "warn" }];
      }
      if (
        name === "messaging.request.incoming_quarantined"
        || name === "account_sync.backup_restore_merge_diagnostics"
        || name === "account_sync.backup_restore_profile_scope_mismatch"
        || name === "groups.membership_recovery_hydrate"
        || name === "groups.membership_ledger_load"
        || name === "groups.room_key_missing_send_blocked"
      ) {
        return [{ name, atUnixMs: 3, level: "info" }];
      }
      if (
        name === "messaging.conversation_hydration_diagnostics"
      ) {
        return [{ name, atUnixMs: 4, level: "warn" }];
      }
      if (
        name === "messaging.realtime_voice.session_transition"
        || name === "messaging.realtime_voice.session_event_ignored"
        || name === "messaging.realtime_voice.connect_timeout_diagnostics"
        || name === "messaging.realtime_voice.connecting_watchdog_gate"
        || name === "messaging.realtime_voice.connecting_watchdog_self_test"
        || name === "messaging.realtime_voice.connecting_watchdog_incident_bundle"
        || name === "messaging.realtime_voice.connecting_watchdog_incident_gate"
        || name === "messaging.realtime_voice.connecting_watchdog_incident_gate_evidence"
        || name === "messaging.realtime_voice.connecting_watchdog_incident_gate_self_test"
        || name === "messaging.voice_note.recording_complete"
        || name === "messaging.delete_for_everyone_remote_result"
      ) {
        return [{ name, atUnixMs: 6, level: "warn" }];
      }
      return [];
    });
    root.obscurAppEvents = {
      getDigest: () => ({ total: 4 }),
      getCrossDeviceSyncDigest: () => ({ totalBufferedEvents: 4 }),
      findByName,
    };

    installM0TriageCapture();
    const api = root.obscurM0Triage as { capture: (eventWindowSize?: number) => unknown };
    const bundle = api.capture() as {
      events: {
        focusedByCategory: Record<string, ReadonlyArray<{ name: string }>>;
      };
    };

    expect(bundle.events.focusedByCategory.startup.some((entry) => entry.name === "runtime.profile_boot_stall_timeout")).toBe(true);
    expect(bundle.events.focusedByCategory.startup.some((entry) => (
      entry.name === "runtime.profile_binding_refresh_timeout"
      || entry.name === "runtime.activation.profile_scope_mismatch"
      || entry.name === "auth.auto_unlock_scope_drift_detected"
    ))).toBe(true);
    expect(bundle.events.focusedByCategory.navigation.some((entry) => entry.name === "navigation.route_stall_hard_fallback" || entry.name === "navigation.route_mount_probe_slow")).toBe(true);
    expect(bundle.events.focusedByCategory.sync_restore.some((entry) => (
      entry.name === "messaging.request.incoming_quarantined"
      || entry.name === "account_sync.backup_restore_merge_diagnostics"
      || entry.name === "account_sync.backup_restore_profile_scope_mismatch"
      || entry.name === "groups.membership_recovery_hydrate"
      || entry.name === "groups.membership_ledger_load"
      || entry.name === "groups.room_key_missing_send_blocked"
    ))).toBe(true);
    expect(bundle.events.focusedByCategory.sync_restore.some((entry) => (
      entry.name === "messaging.request.incoming_quarantined"
    ))).toBe(true);
    expect(bundle.events.focusedByCategory.sync_restore.some((entry) => (
      entry.name === "account_sync.backup_restore_merge_diagnostics"
      || entry.name === "account_sync.backup_restore_profile_scope_mismatch"
      || entry.name === "groups.membership_recovery_hydrate"
      || entry.name === "groups.membership_ledger_load"
      || entry.name === "groups.room_key_missing_send_blocked"
    ))).toBe(true);
    expect(bundle.events.focusedByCategory.media_hydration.some((entry) => entry.name === "messaging.conversation_hydration_diagnostics")).toBe(true);
    expect(bundle.events.focusedByCategory.voice_realtime.some((entry) => entry.name === "messaging.realtime_voice.session_transition")).toBe(true);
    expect(bundle.events.focusedByCategory.voice_realtime.some((entry) => entry.name === "messaging.realtime_voice.session_event_ignored")).toBe(true);
    expect(bundle.events.focusedByCategory.voice_realtime.some((entry) => entry.name === "messaging.realtime_voice.connect_timeout_diagnostics")).toBe(true);
    expect(bundle.events.focusedByCategory.voice_realtime.some((entry) => entry.name === "messaging.realtime_voice.connecting_watchdog_gate")).toBe(true);
    expect(bundle.events.focusedByCategory.voice_realtime.some((entry) => entry.name === "messaging.realtime_voice.connecting_watchdog_self_test")).toBe(true);
    expect(bundle.events.focusedByCategory.voice_realtime.some((entry) => entry.name === "messaging.realtime_voice.connecting_watchdog_incident_bundle")).toBe(true);
    expect(bundle.events.focusedByCategory.voice_realtime.some((entry) => entry.name === "messaging.realtime_voice.connecting_watchdog_incident_gate")).toBe(true);
    expect(bundle.events.focusedByCategory.voice_realtime.some((entry) => entry.name === "messaging.realtime_voice.connecting_watchdog_incident_gate_evidence")).toBe(true);
    expect(bundle.events.focusedByCategory.voice_realtime.some((entry) => entry.name === "messaging.realtime_voice.connecting_watchdog_incident_gate_self_test")).toBe(true);
    expect(bundle.events.focusedByCategory.voice_realtime.some((entry) => entry.name === "messaging.voice_note.recording_complete")).toBe(true);
    expect(bundle.events.focusedByCategory.voice_realtime.some((entry) => entry.name === "messaging.delete_for_everyone_remote_result")).toBe(true);
    expect(findByName).toHaveBeenCalled();
  });

  it("normalizes invalid event window values to a positive integer", () => {
    expect(m0TriageCaptureInternals.getNumericWindowSize(320.7)).toBe(320);
    expect(m0TriageCaptureInternals.getNumericWindowSize(0)).toBe(1);
    expect(m0TriageCaptureInternals.getNumericWindowSize(Number.NaN)).toBe(300);
    expect(m0TriageCaptureInternals.getNumericWindowSize(undefined)).toBe(300);
  });
});
