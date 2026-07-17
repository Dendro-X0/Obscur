import React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveToVaultControl } from "./save-to-vault-control";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@dweb/ui-kit", () => ({
  Progress: ({ value }: { value?: number }) => (
    <div data-testid="progress-bar" data-value={value ?? 0} />
  ),
}));

describe("SaveToVaultControl", () => {
  it("shows a progress bar while saving", () => {
    vi.useFakeTimers();
    render(
      <SaveToVaultControl
        isSaving
        isSaved={false}
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByTestId("save-to-vault-progress")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "vault.saveFromChatSaving" })).toBeDisabled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId("progress-bar")).toHaveAttribute("data-value");

    vi.useRealTimers();
  });

  it("hides progress when idle or already saved", () => {
    const { rerender } = render(
      <SaveToVaultControl isSaving={false} isSaved={false} onSave={vi.fn()} />,
    );
    expect(screen.queryByTestId("save-to-vault-progress")).not.toBeInTheDocument();

    rerender(<SaveToVaultControl isSaving={false} isSaved onSave={vi.fn()} />);
    expect(screen.queryByTestId("save-to-vault-progress")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "vault.alreadyInVault" })).toBeDisabled();
  });
});
