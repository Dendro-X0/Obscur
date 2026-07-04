import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppLockConfirmDialog } from "./app-lock-confirm-dialog";
import en from "@/app/lib/i18n/locales/en.json";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => (en.translation as Record<string, string | undefined>)[key] ?? key,
  }),
}));

describe("AppLockConfirmDialog", () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();

  beforeEach(() => {
    onClose.mockReset();
    onConfirm.mockReset();
  });

  it("shows lock confirmation copy when open", () => {
    render(
      <AppLockConfirmDialog isOpen onClose={onClose} onConfirm={onConfirm} />,
    );
    expect(screen.getByText("Lock Obscur?")).toBeTruthy();
    expect(screen.getByText(/Your account stays on this device/)).toBeTruthy();
  });

  it("calls onConfirm when lock is confirmed", () => {
    render(
      <AppLockConfirmDialog isOpen onClose={onClose} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lock" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
