import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TransportPresetCatalogPanel } from "./transport-preset-catalog-panel";
import { resolveTransportPresetMatches, resolveActiveTransportMix } from "./transport-preset-match";
import { classifyRelayEndpointAdapter } from "./relay-endpoint-adapter";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = () => {
  const relays = [
    { url: "wss://relay.damus.io", enabled: true },
    { url: "wss://nos.lol", enabled: true },
    { url: "wss://relay.primal.net", enabled: true },
  ];
  return {
    presetMatches: resolveTransportPresetMatches(relays, "basic"),
    activeMix: resolveActiveTransportMix(relays, "basic", classifyRelayEndpointAdapter),
    activePresetId: "default_stable" as const,
  };
};

describe("TransportPresetCatalogPanel", () => {
  it("renders all transport category groups and preset apply actions", () => {
    const onApply = vi.fn();
    const props = defaultProps();
    render(
      <TransportPresetCatalogPanel
        onApplyPreset={onApply}
        translatePresetLabel={(id) => id}
        presetMatches={props.presetMatches}
        activeMix={props.activeMix}
        activePresetId={props.activePresetId}
      />,
    );

    expect(screen.getByText("settings.relays.presetGroup.publicNostr")).toBeTruthy();
    expect(screen.getByText("settings.relays.presetGroup.privateMesh")).toBeTruthy();
    expect(screen.getAllByText("settings.relays.presetMatch.active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("settings.relays.applyPreset").length).toBeGreaterThanOrEqual(6);
  });

  it("calls onApplyPreset when a pack is applied", () => {
    const onApply = vi.fn();
    const props = defaultProps();
    render(
      <TransportPresetCatalogPanel
        onApplyPreset={onApply}
        translatePresetLabel={() => "Local Dev Mesh"}
        presetMatches={props.presetMatches}
        activeMix={props.activeMix}
      />,
    );

    const applyButtons = screen.getAllByRole("button", { name: "settings.relays.applyPreset" });
    fireEvent.click(applyButtons[0]!);
    expect(onApply).toHaveBeenCalled();
  });

  it("disables Tor pack apply when Tor is not ready", () => {
    const onApply = vi.fn();
    const props = defaultProps();
    render(
      <TransportPresetCatalogPanel
        onApplyPreset={onApply}
        translatePresetLabel={(id) => id}
        presetMatches={props.presetMatches}
        activeMix={props.activeMix}
        torState={{ configured: true, ready: false }}
        onNavigateToSecurity={vi.fn()}
      />,
    );

    const applyButtons = screen.getAllByRole("button", { name: "settings.relays.applyPreset" });
    const torApplyButton = applyButtons.find((button) => button.hasAttribute("disabled"));
    expect(torApplyButton).toBeTruthy();
    expect(screen.getByText("settings.conduits.torNotReadyBadge")).toBeTruthy();
    expect(screen.getByText("settings.relays.torGateSecurityLink")).toBeTruthy();
  });
});
