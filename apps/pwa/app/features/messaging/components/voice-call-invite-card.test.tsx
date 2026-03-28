import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VoiceCallInviteCard } from "./voice-call-invite-card";

describe("VoiceCallInviteCard", () => {
  it("renders voice call invite metadata with room hint", () => {
    render(
      <VoiceCallInviteCard
        isOutgoing={false}
        invite={{
          type: "voice-call-invite",
          version: 1,
          roomId: "dm-voice-1234567890abcdefghijklmnopqrstuvwxyz",
          invitedAtUnixMs: 1_777_777_777_000,
          expiresAtUnixMs: 1_777_778_077_000,
        }}
      />
    );

    expect(screen.getByText("Voice Call Invite")).toBeInTheDocument();
    expect(screen.getByText("Incoming invitation")).toBeInTheDocument();
    expect(screen.getByText(/^Room:/)).toBeInTheDocument();
    expect(screen.getByText(/^Invited:/)).toBeInTheDocument();
    expect(screen.getByText(/^Expires:/)).toBeInTheDocument();
  });

  it("triggers join callback for incoming invite", () => {
    const onJoinCall = vi.fn();
    render(
      <VoiceCallInviteCard
        isOutgoing={false}
        onJoinCall={onJoinCall}
        invite={{
          type: "voice-call-invite",
          roomId: "dm-voice-room-a",
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Join Call" }));
    expect(onJoinCall).toHaveBeenCalledWith(expect.objectContaining({
      type: "voice-call-invite",
      roomId: "dm-voice-room-a",
    }));
  });

  it("renders ended call log with duration and no callback action for normal ended calls", () => {
    render(
      <VoiceCallInviteCard
        isOutgoing={false}
        invite={{
          type: "voice-call-invite",
          roomId: "dm-voice-room-b",
          invitedAtUnixMs: 10_000,
        }}
        callSummary={{
          roomId: "dm-voice-room-b",
          invitedAtUnixMs: 10_000,
          expiresAtUnixMs: 310_000,
          connectedAtUnixMs: 20_000,
          endedAtUnixMs: 95_000,
          endedNormally: true,
          durationSeconds: 75,
        }}
      />
    );

    expect(screen.getByText(/^Ended:/)).toBeInTheDocument();
    expect(screen.getByText(/^Duration:/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Call Back" })).not.toBeInTheDocument();
  });

  it("shows one-time callback action for timeout/unconnected calls", () => {
    const onRequestCallback = vi.fn();
    render(
      <VoiceCallInviteCard
        isOutgoing={false}
        onRequestCallback={onRequestCallback}
        nowUnixMs={1_000_000}
        invite={{
          type: "voice-call-invite",
          roomId: "dm-voice-room-c",
          expiresAtUnixMs: 999_000,
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Call Back" }));
    expect(onRequestCallback).toHaveBeenCalledTimes(1);
  });
});
