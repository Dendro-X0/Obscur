/**
 * Dev-only agent bridge for CodaCtrl Verify MCP (Lane C).
 * Contract: codactrl docs/specs/obscur-agent-bridge-scripts.md
 */
import { getAllWindows, getCurrentWindow, Window as TauriWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { desktopProfileRuntime } from "@/app/features/profiles/services/desktop-profile-runtime";
import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

const SCHEMA = "obscur.agent.bridge@0.1.0";

function readActiveTab(): { tab: "chats" | "profiles" | "unknown"; href: string } {
  const href = window.location.pathname + window.location.search;
  if (href === "/" || href.startsWith("/chats")) {
    return { tab: "chats", href };
  }
  if (href.includes("/profiles") || href.includes("/profile")) {
    return { tab: "profiles", href };
  }
  return { tab: "unknown", href };
}

async function listWindows() {
  const windows = await getAllWindows();
  const focused = await TauriWindow.getFocusedWindow();
  const focusedLabel = focused?.label ?? null;
  return Promise.all(
    windows.map(async (win) => ({
      label: win.label,
      focused: win.label === focusedLabel,
      visible: await win.isVisible(),
      title: await win.title().catch(() => ""),
    })),
  );
}

async function focusWindow(label: string) {
  try {
    await invokeNativeCommand<void>("desktop_agent_focus_window", { label });
    return { ok: true, label, invoked: "desktop_agent_focus_window" };
  } catch (err) {
    try {
      const win = await WebviewWindow.getByLabel(label);
      if (!win) {
        return { ok: false, label, reason: `no window with label ${label}` };
      }
      await win.setFocus();
      await win.show();
      return { ok: true, label, invoked: "webview_window_api" };
    } catch (fallbackErr) {
      return { ok: false, label, reason: String(err), fallbackReason: String(fallbackErr) };
    }
  }
}

async function navigateRoute(href: string) {
  try {
    const target = href.startsWith("/") ? href : `/${href}`;
    window.history.pushState({}, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
    return { ok: true, href: target, tab: readActiveTab().tab };
  } catch (err) {
    return { ok: false, href, reason: String(err) };
  }
}

async function resolveProfileForSlot(slot: 1 | 2) {
  const profiles = await desktopProfileRuntime.listProfiles();
  if (profiles.length === 0) {
    return { ok: false as const, reason: "no profiles registered on device" };
  }
  const byLabel = profiles.find((row) =>
    slot === 2
      ? /tester2/i.test(row.label)
      : /tester1/i.test(row.label),
  );
  if (byLabel) {
    return { ok: true as const, profileId: byLabel.profileId, label: byLabel.label };
  }
  const index = slot === 1 ? 0 : 1;
  const profile = profiles[index];
  if (!profile) {
    return {
      ok: false as const,
      reason: `profile slot ${slot} not configured — add Tester${slot} or create a second profile`,
    };
  }
  return { ok: true as const, profileId: profile.profileId, label: profile.label };
}

async function openProfileSlot(slot: 1 | 2) {
  if (!hasNativeRuntime()) {
    return { ok: false, slot, reason: "native runtime required for openProfileSlot" };
  }
  const resolved = await resolveProfileForSlot(slot);
  if (!resolved.ok) {
    return { ok: false, slot, reason: resolved.reason };
  }
  try {
    await desktopProfileRuntime.openProfileWindow(resolved.profileId);
    const current = await getCurrentWindow();
    const label = current.label;
    return {
      ok: true,
      slot,
      profileId: resolved.profileId,
      profileLabel: resolved.label,
      label,
      invoked: "desktop_open_profile_window",
    };
  } catch (err) {
    return { ok: false, slot, reason: String(err) };
  }
}

async function captureJson(limit = 300) {
  const w = window as Window & {
    obscurM0Triage?: { captureJson?: (n: number) => unknown };
  };
  if (typeof w.obscurM0Triage?.captureJson === "function") {
    return w.obscurM0Triage.captureJson(limit);
  }
  return {
    schema: "codactrl.runtime.digest@1.0.0",
    error: "obscurM0Triage.captureJson missing",
    symptomIds: [],
  };
}

export const codactrlAgentBridge = {
  schema: SCHEMA,
  listWindows,
  focusWindow,
  navigateRoute,
  activeTab: readActiveTab,
  openProfileSlot,
  captureJson,
};

declare global {
  interface Window {
    __codactrlAgentBridge?: typeof codactrlAgentBridge;
  }
}

export const installCodactrlAgentBridge = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  if (process.env.NEXT_PUBLIC_OBSCUR_DEV_LAB !== "1") {
    return;
  }
  window.__codactrlAgentBridge = codactrlAgentBridge;
  console.info(`[agent-bridge] ${SCHEMA} ready`);
};
