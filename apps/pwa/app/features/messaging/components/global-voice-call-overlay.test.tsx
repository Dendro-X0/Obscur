import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GlobalVoiceCallOverlay } from "./global-voice-call-overlay";
import {
  clearGlobalVoiceCallOverlayState,
  setGlobalVoiceCallOverlayState,
} from "../services/realtime-voice-global-ui-store";

const routerMocks = vi.hoisted(() => ({
  pathname: "/network",
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => routerMocks.pathname,
  useRouter: () => ({
    push: routerMocks.push,
  }),
}));

vi.mock("./voice-call-dock", () => ({
  VoiceCallDock: (props: Readonly<{
    status: { phase: string } | null;
    peerDisplayName: string;
    onOpenChat: () => void;
  }>) => (
    <div>
      <span>{props.peerDisplayName}</span>
      <span>{props.status?.phase ?? "none"}</span>
      <button type="button" onClick={props.onOpenChat}>Open Chat</button>
    </div>
  ),
}));

vi.mock("./incoming-voice-call-toast", () => ({
  IncomingVoiceCallToast: (props: Readonly<{
    isOpen: boolean;
    inviterDisplayName: string;
    roomIdHint: string;
    onAccept: () => void;
    onDismiss: () => void;
  }>) => (
    <div>
      <span>{props.isOpen ? "toast-open" : "toast-closed"}</span>
      <span>{props.inviterDisplayName}</span>
      <span>{props.roomIdHint}</span>
      <button type="button" onClick={props.onAccept}>Accept</button>
      <button type="button" onClick={props.onDismiss}>Dismiss</button>
    </div>
  ),
}));

describe("GlobalVoiceCallOverlay", () => {
  beforeEach(() => {
    routerMocks.pathname = "/network";
    routerMocks.push.mockReset();
    clearGlobalVoiceCallOverlayState();
  });

  afterEach(() => {
    cleanup();
    clearGlobalVoiceCallOverlayState();
  });

  it("renders nothing when there is no active voice status", () => {
    const { container } = render(<GlobalVoiceCallOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it("renders global dock on non-chat routes and opens chat route", () => {
    setGlobalVoiceCallOverlayState({
      status: {
        roomId: "room-1",
        peerPubkey: "a".repeat(64),
        phase: "connected",
        role: "host",
        sinceUnixMs: Date.now(),
      },
      peerDisplayName: "Alice",
      peerAvatarUrl: "",
    });
    render(<GlobalVoiceCallOverlay />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open Chat" }));
    expect(routerMocks.push).toHaveBeenCalledWith("/");
  });

  it("stays hidden on chat route to avoid duplicate dock rendering", () => {
    routerMocks.pathname = "/";
    setGlobalVoiceCallOverlayState({
      status: {
        roomId: "room-2",
        peerPubkey: "b".repeat(64),
        phase: "ringing_outgoing",
        role: "host",
        sinceUnixMs: Date.now(),
      },
      peerDisplayName: "Bob",
      peerAvatarUrl: "",
    });
    const { container } = render(<GlobalVoiceCallOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it("renders incoming-call toast on non-chat routes", () => {
    setGlobalVoiceCallOverlayState({
      status: {
        roomId: "dm-voice-call-room-abcdef1234567890",
        peerPubkey: "c".repeat(64),
        phase: "ringing_incoming",
        role: "joiner",
        sinceUnixMs: Date.now(),
      },
      peerDisplayName: "Carol",
      peerAvatarUrl: "",
    });
    render(<GlobalVoiceCallOverlay />);
    expect(screen.getByText("toast-open")).toBeInTheDocument();
    expect(screen.getByText("Carol")).toBeInTheDocument();
    expect(screen.getByText("dm-voice-c...1234567890")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(routerMocks.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(routerMocks.push).not.toHaveBeenCalled();
  });
});
