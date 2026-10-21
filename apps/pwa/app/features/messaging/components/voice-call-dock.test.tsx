import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VoiceCallDock } from "./voice-call-dock";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("@/app/components/user-avatar", () => ({
  UserAvatar: (props: Readonly<{ username: string }>) => (
    <span data-testid="user-avatar">{props.username}</span>
  ),
}));

describe("VoiceCallDock M1-A video panes", () => {
  afterEach(() => {
    cleanup();
  });

  const baseStatus = {
    roomId: "room-1",
    peerPubkey: "a".repeat(64),
    phase: "connected" as const,
    role: "host" as const,
    sinceUnixMs: Date.now(),
  };

  it("does not render video panes for voice callType", () => {
    render(
      <VoiceCallDock
        status={{ ...baseStatus, callType: "voice" }}
        peerDisplayName="Alice"
        onOpenChat={() => undefined}
        onEnd={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.queryByTestId("voice-call-dock-video-panes")).toBeNull();
  });

  it("renders local/remote placeholder panes for negotiated video after peer engages", () => {
    render(
      <VoiceCallDock
        status={{ ...baseStatus, callType: "video", phase: "connected" }}
        peerDisplayName="Alice"
        onOpenChat={() => undefined}
        onEnd={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByTestId("voice-call-dock-video-panes")).toBeTruthy();
    expect(screen.getByTestId("voice-call-dock-local-video")).toBeTruthy();
    expect(screen.getByTestId("voice-call-dock-remote-video")).toBeTruthy();
    expect(screen.getAllByText("Camera unavailable")).toHaveLength(2);
  });

  it("keeps outgoing video ring on compact dock without AV panes or stage", () => {
    render(
      <VoiceCallDock
        status={{ ...baseStatus, callType: "video", phase: "ringing_outgoing" }}
        peerDisplayName="Alice"
        presentation="dock"
        onOpenChat={() => undefined}
        onEnd={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.queryByTestId("voice-call-desktop-stage")).toBeNull();
    expect(screen.queryByTestId("voice-call-mobile-stage")).toBeNull();
    expect(screen.queryByTestId("voice-call-dock-video-panes")).toBeNull();
    expect(screen.getByText("messaging.voiceCallRingingOutgoing")).toBeTruthy();
  });

  it("M1-B: shows honesty banner when video falls back to audio-only", () => {
    render(
      <VoiceCallDock
        status={{
          ...baseStatus,
          callType: "video",
          mediaMode: "audio_only_fallback",
        }}
        peerDisplayName="Alice"
        onOpenChat={() => undefined}
        onEnd={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByTestId("voice-call-dock-camera-unavailable-banner")).toBeTruthy();
    expect(screen.getByText("Camera unavailable — continuing with voice")).toBeTruthy();
  });

  it("uses a full-screen stage for mobile video only after peer engages", () => {
    const { rerender } = render(
      <VoiceCallDock
        status={{ ...baseStatus, callType: "video", phase: "connecting" }}
        peerDisplayName="Alice"
        presentation="fullscreen"
        onOpenChat={() => undefined}
        onEnd={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByTestId("voice-call-mobile-stage")).toBeTruthy();
    expect(screen.getByTestId("voice-call-dock-remote-video").className).toContain("inset-0");
    expect(screen.getByTestId("voice-call-dock-local-video").className).toContain("w-28");

    rerender(
      <VoiceCallDock
        status={{ ...baseStatus, callType: "voice", phase: "connecting" }}
        peerDisplayName="Alice"
        presentation="fullscreen"
        onOpenChat={() => undefined}
        onEnd={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.queryByTestId("voice-call-mobile-stage")).toBeNull();
  });

  it("R5: uses a floating desktop stage for video without taking the full window", () => {
    render(
      <VoiceCallDock
        status={{ ...baseStatus, callType: "video", phase: "connected" }}
        peerDisplayName="Alice"
        presentation="stage"
        onOpenChat={() => undefined}
        onEnd={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    const stage = screen.getByTestId("voice-call-desktop-stage");
    expect(stage).toBeTruthy();
    expect(stage.style.position).toBe("fixed");
    expect(stage.style.width).toContain("36rem");
    expect(stage.style.left).toBeTruthy();
    expect(stage.style.top).toBeTruthy();
    expect(screen.getByTestId("voice-call-desktop-stage-drag-handle")).toBeTruthy();
    expect(screen.getByTestId("voice-call-desktop-stage-fullscreen-toggle")).toBeTruthy();
    expect(screen.queryByTestId("voice-call-mobile-stage")).toBeNull();
    expect(screen.queryByTestId("voice-call-dock-video-panes")).toBeNull();
    expect(screen.getByTestId("voice-call-dock-remote-video").className).toContain("inset-0");
    expect(screen.getByTestId("voice-call-dock-local-video").className).toContain("w-28");
  });

  it("desktop stage can expand to in-app fullscreen", () => {
    render(
      <VoiceCallDock
        status={{ ...baseStatus, callType: "video", phase: "connected" }}
        peerDisplayName="Alice"
        presentation="stage"
        onOpenChat={() => undefined}
        onEnd={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    fireEvent.click(screen.getByTestId("voice-call-desktop-stage-fullscreen-toggle"));
    const fullscreen = screen.getByTestId("voice-call-desktop-stage-fullscreen");
    expect(fullscreen.style.position).toBe("fixed");
    expect(["0", "0px"]).toContain(fullscreen.style.inset);
    expect(fullscreen.style.width).toBe("100vw");
    expect(screen.queryByTestId("voice-call-desktop-stage-drag-handle")).toBeNull();
  });

  it("M1-C: labels lab canvas as not a camera", () => {
    render(
      <VoiceCallDock
        status={{
          ...baseStatus,
          callType: "video",
          mediaMode: "av_lab_canvas",
        }}
        peerDisplayName="Alice"
        onOpenChat={() => undefined}
        onEnd={() => undefined}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.getByTestId("voice-call-dock-lab-canvas-banner")).toBeTruthy();
    expect(screen.queryByTestId("voice-call-dock-camera-unavailable-banner")).toBeNull();
  });
});
