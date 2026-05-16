import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DEFAULT_STORAGE_PORTS } from "../services/default-storage-ports";
import { ProfileRuntimeProvider, useResolvedStoragePorts } from "./profile-runtime-provider";

function ReadSuppressedIds(): React.JSX.Element {
  const ids = useResolvedStoragePorts().messageDeleteTombstones.loadSuppressedMessageDeleteIds(0, "test-profile");
  return <span data-testid="ids">{[...ids].sort().join(",")}</span>;
}

describe("ProfileRuntimeProvider storagePorts", () => {
  it("exposes merged tombstone port from partial override", () => {
    const loadSuppressedMessageDeleteIds = vi.fn(() => new Set(["a", "b"]));
    const storagePorts = {
      messageDeleteTombstones: {
        ...DEFAULT_STORAGE_PORTS.messageDeleteTombstones,
        loadSuppressedMessageDeleteIds,
      },
    };

    render(
      <ProfileRuntimeProvider storagePorts={storagePorts}>
        <ReadSuppressedIds />
      </ProfileRuntimeProvider>,
    );

    expect(screen.getByTestId("ids").textContent).toBe("a,b");
    expect(loadSuppressedMessageDeleteIds).toHaveBeenCalledWith(0, "test-profile");
  });
});
