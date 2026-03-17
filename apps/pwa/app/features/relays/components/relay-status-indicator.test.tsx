import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelayStatusIndicator } from "./relay-status-indicator";

vi.mock("../providers/relay-provider", () => ({
  useRelay: vi.fn(() => ({
    relayPool: {
      connections: [
        { url: "wss://relay.example", status: "open", updatedAtUnixMs: 1 },
      ],
    },
    relayRuntime: {
      phase: "healthy",
      writableRelayCount: 1,
      enabledRelayUrls: ["wss://relay.example"],
    },
  })),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (value: string) => value,
  }),
}));

describe("RelayStatusIndicator", () => {
  it("uses the live relay provider snapshot instead of an empty standalone pool", () => {
    render(<RelayStatusIndicator />);

    expect(screen.getByText("relays.connected")).toBeInTheDocument();
    expect(screen.getByText("1/1 relays.active_relays")).toBeInTheDocument();
  });

  it("shows offline when no writable relays exist and runtime is not recovering", async () => {
    const { useRelay } = await import("../providers/relay-provider");
    vi.mocked(useRelay).mockReturnValue({
      relayPool: {
        connections: [],
      },
      relayRuntime: {
        phase: "offline",
        writableRelayCount: 0,
        enabledRelayUrls: ["wss://relay.example"],
      },
    } as any);

    render(<RelayStatusIndicator />);

    expect(screen.getByText("relays.offline")).toBeInTheDocument();
    expect(screen.getByText("0/1 relays.active_relays")).toBeInTheDocument();
  });
});
