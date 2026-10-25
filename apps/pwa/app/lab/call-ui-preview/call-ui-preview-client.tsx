"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { VoiceCallDock } from "@/app/features/messaging/components/voice-call-dock";
import { IncomingVoiceCallToast } from "@/app/features/messaging/components/incoming-voice-call-toast";
import {
  CALL_UI_PREVIEW_SCENES,
  DEFAULT_CALL_UI_PREVIEW_CYCLE_MS,
  nextCallUiPreviewSceneId,
  resolveCallUiPreviewScene,
  type CallUiPreviewSceneId,
} from "@/app/features/messaging/lab/call-ui-preview-scenes";
import { CLIENT_BUILD_STAMP } from "@/app/shared/client-build-stamp";

const noop = (): void => {};

/**
 * No-unlock, no-contact fixture surface for real VoiceCallDock / IncomingVoiceCallToast.
 * Default: auto-cycle scenes. Lock with ?scene=<id>&cycle=0
 */
export function CallUiPreviewClient(): React.JSX.Element {
  const searchParams = useSearchParams();
  const sceneParam = searchParams.get("scene");
  const cycleParam = searchParams.get("cycle");
  const cycleEnabled = cycleParam !== "0" && cycleParam !== "false";
  const cycleMsRaw = Number(searchParams.get("ms") ?? DEFAULT_CALL_UI_PREVIEW_CYCLE_MS);
  const cycleMs = Number.isFinite(cycleMsRaw) && cycleMsRaw >= 1500
    ? cycleMsRaw
    : DEFAULT_CALL_UI_PREVIEW_CYCLE_MS;

  const [sceneId, setSceneId] = useState<CallUiPreviewSceneId>(
    () => resolveCallUiPreviewScene(sceneParam).id,
  );

  useEffect(() => {
    if (sceneParam) {
      setSceneId(resolveCallUiPreviewScene(sceneParam).id);
    }
  }, [sceneParam]);

  useEffect(() => {
    if (!cycleEnabled || sceneParam) {
      return;
    }
    const timerId = window.setInterval(() => {
      setSceneId((current) => nextCallUiPreviewSceneId(current));
    }, cycleMs);
    return () => window.clearInterval(timerId);
  }, [cycleEnabled, cycleMs, sceneParam]);

  const scene = useMemo(() => resolveCallUiPreviewScene(sceneId), [sceneId]);

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden bg-zinc-950 text-zinc-100"
      data-testid="call-ui-preview-root"
      data-scene={scene.id}
    >
      {/* Fake mobile chrome backdrop so dock/toast offset is inspectable */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1e1b4b_0%,_#09090b_55%)]" />
      <header className="relative z-10 flex items-start justify-between gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
            Call UI lab · {CLIENT_BUILD_STAMP}
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight">{scene.label}</h1>
          <p className="mt-1 max-w-sm text-xs text-zinc-400">
            No unlock, contacts, or relays. Real dock/toast chrome only.
            {cycleEnabled && !sceneParam
              ? ` Auto-cycling every ${Math.round(cycleMs / 1000)}s — ?scene=id&cycle=0 to lock.`
              : " Locked scene — remove ?scene or set cycle=1 to auto-advance."}
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-300">
          {scene.id}
        </div>
      </header>

      <div className="relative z-10 mx-auto mt-6 grid max-w-lg gap-2 px-4 pb-40">
        {CALL_UI_PREVIEW_SCENES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${
              entry.id === scene.id
                ? "border-violet-400/50 bg-violet-500/20 text-violet-100"
                : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10"
            }`}
            onClick={() => setSceneId(entry.id)}
            data-testid={`call-ui-preview-scene-${entry.id}`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {/* Simulated tab bar / composer clearance so connected dock vs chat offset is visible */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] border-t border-white/10 bg-zinc-900/90 px-4 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        aria-hidden
      >
        <div className="mx-auto flex max-w-lg justify-around text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          <span>Chats</span>
          <span>Network</span>
          <span>Vault</span>
          <span>Search</span>
          <span>Settings</span>
        </div>
      </div>

      {scene.kind === "toast" ? (
        <IncomingVoiceCallToast
          isOpen
          inviterDisplayName={scene.peerDisplayName}
          roomIdHint={scene.status.roomId}
          anchorMode="page"
          onAccept={noop}
          onDecline={noop}
          onDismiss={noop}
        />
      ) : (
        <VoiceCallDock
          status={scene.status}
          peerDisplayName={scene.peerDisplayName}
          anchorMode="page"
          audioLevel={scene.audioLevel}
          onOpenChat={noop}
          onAccept={noop}
          onDecline={noop}
          onEnd={noop}
          onDismiss={noop}
          presentation={scene.presentation}
        />
      )}
    </div>
  );
}
