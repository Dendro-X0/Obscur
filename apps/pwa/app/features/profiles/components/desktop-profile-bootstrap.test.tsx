import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopProfileBootstrap } from "./desktop-profile-bootstrap";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { startDesktopWindowBoot } from "@/app/features/profiles/services/desktop-window-boot";

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: vi.fn(),
}));

vi.mock("@/app/features/profiles/services/desktop-window-boot", () => ({
  startDesktopWindowBoot: vi.fn(),
}));

describe("DesktopProfileBootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasNativeRuntime).mockReturnValue(false);
  });

  it("renders children without blocking in non-native web runtime", async () => {
    render(
      <DesktopProfileBootstrap>
        <div>ready-content</div>
      </DesktopProfileBootstrap>,
    );

    await waitFor(() => {
      expect(screen.getByText("ready-content")).toBeInTheDocument();
    });
    expect(startDesktopWindowBoot).not.toHaveBeenCalled();
  });

  it("renders children immediately in native desktop runtime", async () => {
    vi.mocked(hasNativeRuntime).mockReturnValue(true);

    render(
      <DesktopProfileBootstrap>
        <div>ready-content</div>
      </DesktopProfileBootstrap>,
    );

    await waitFor(() => {
      expect(screen.getByText("ready-content")).toBeInTheDocument();
    });
    expect(startDesktopWindowBoot).toHaveBeenCalledTimes(1);
  });
});
