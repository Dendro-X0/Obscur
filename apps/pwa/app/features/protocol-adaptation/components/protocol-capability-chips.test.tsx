import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProtocolCapabilityChips } from "./protocol-capability-chips";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

vi.mock("../use-active-protocol-capabilities", () => ({
  useActiveProtocolCapabilities: () => ({
    protocolId: "nostr",
    transportId: "clearnet",
    capabilities: { dms: true, groups: true, reactions: true, media: true },
  }),
}));

describe("ProtocolCapabilityChips", () => {
  it("renders protocol label and capability states from snapshot", () => {
    render(
      <ProtocolCapabilityChips
        snapshot={{
          protocolId: "matrix",
          capabilities: { dms: true, groups: true, reactions: false, media: false },
        }}
      />,
    );
    expect(screen.getByTestId("protocol-capability-protocol")).toHaveTextContent("Matrix");
    expect(screen.getByTestId("protocol-capability-media")).toHaveAttribute("data-capability-on", "0");
    expect(screen.getByTestId("protocol-capability-dms")).toHaveAttribute("data-capability-on", "1");
  });
});
