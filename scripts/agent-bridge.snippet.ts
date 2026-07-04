/**
 * Obscur dev-only agent bridge — copy to src/dev/agent-bridge.ts
 * Contract: docs/specs/obscur-agent-bridge-scripts.md
 */
import { getAllWindows, WebviewWindow } from "@tauri-apps/api/window";

const SCHEMA = "obscur.agent.bridge@0.1.0";

function tauriInvoke(): ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null {
  const w = window as Window & {
    __TAURI__?: { core?: { invoke?: typeof invokeFallback }; invoke?: typeof invokeFallback };
  };
  return w.__TAURI__?.core?.invoke ?? w.__TAURI__?.invoke ?? null;
}

async function invokeFallback(_cmd: string, _args?: Record<string, unknown>): Promise<unknown> {
  return null;
}

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
  const focused = WebviewWindow.getFocusedWindow();
  const focusedLabel = focused ? (await focused.label) : null;
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
    const win = await WebviewWindow.getByLabel(label);
    if (!win) {
      return { ok: false, label, reason: `no window with label ${label}` };
    }
    await win.setFocus();
    await win.show();
    return { ok: true, label };
  } catch (err) {
    return { ok: false, label, reason: String(err) };
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

/**
 * Obscur-specific: wire to your existing profile-slot opener.
 * Replace body with real invoke / UI automation for your repo.
 */
async function openProfileSlot(slot: 1 | 2) {
  const invoke = tauriInvoke();
  if (invoke) {
    try {
      const result = await invoke("obscur_dev_open_profile_slot", { slot });
      return { ok: true, slot, result };
    } catch {
      // fall through to DOM path
    }
  }
  if (slot === 2) {
    const manage = document.querySelector('[data-testid="manage-profiles"], a[href*="/profiles"]');
    if (manage instanceof HTMLElement) {
      manage.click();
    }
    const slotButton = document.querySelector('[data-profile-slot="2"], [aria-label*="Needs setup"]');
    if (slotButton instanceof HTMLElement) {
      slotButton.click();
      return { ok: true, slot, label: "profile-slot-2", toast: "clicked slot 2 selector" };
    }
    return { ok: false, slot, reason: "slot 2 selector not found — configure Tester2 or add data-profile-slot" };
  }
  return { ok: false, slot, reason: "slot 1 open not implemented in bridge stub" };
}

async function captureJson(limit = 300) {
  const w = window as Window & {
    obscurM0Triage?: { captureJson?: (n: number) => unknown };
  };
  if (typeof w.obscurM0Triage?.captureJson === "function") {
    return w.obscurM0Triage.captureJson(limit);
  }
  return { schema: "codactrl.runtime.digest@1.0.0", error: "obscurM0Triage.captureJson missing", symptomIds: [] };
}

export const agentBridge = {
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
    __codactrlAgentBridge?: typeof agentBridge;
  }
}

if (import.meta.env.DEV) {
  window.__codactrlAgentBridge = agentBridge;
  console.info(`[agent-bridge] ${SCHEMA} ready`);
}
