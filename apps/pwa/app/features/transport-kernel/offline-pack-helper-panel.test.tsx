import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { OfflinePackHelperPanel } from "./offline-pack-helper-panel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
  }),
}));

vi.mock("@obscur/engine-host/tauri", () => ({
  isTauriEngineHostAvailable: () => false,
  createTauriEngineHost: () => ({
    invoke: vi.fn(),
    getSnapshot: vi.fn(),
    subscribe: () => () => {},
  }),
}));

vi.mock("@dweb/ui-kit/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("OfflinePackHelperPanel — RUST-6d", () => {
  it("renders evidence note and profile scope", () => {
    render(<OfflinePackHelperPanel profileId="bob" />);
    expect(screen.getByTestId("offline-pack-helper-panel")).toBeInTheDocument();
    expect(
      screen.getByText(/Imported offline means the pack was accepted/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/profileId=bob/)).toBeInTheDocument();
    expect(screen.getByText(/desktop \(Tauri\) host/i)).toBeInTheDocument();
  });
});
