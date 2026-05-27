import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LazyGlobalDialogManager } from "./lazy-global-dialog-manager";

const dialogState = vi.hoisted(() => ({
  isNewChatOpen: false,
  isNewGroupOpen: false,
}));

const globalDialogManagerMock = vi.hoisted(() =>
  vi.fn(() => <div data-testid="global-dialog-manager" />),
);

vi.mock("@/app/features/messaging/providers/messaging-provider", () => ({
  useMessaging: () => ({
    isNewChatOpen: dialogState.isNewChatOpen,
  }),
}));

vi.mock("@/app/features/groups/providers/group-provider", () => ({
  useGroups: () => ({
    isNewGroupOpen: dialogState.isNewGroupOpen,
  }),
}));

vi.mock("next/dynamic", () => ({
  default: () => globalDialogManagerMock,
}));

describe("LazyGlobalDialogManager", () => {
  beforeEach(() => {
    dialogState.isNewChatOpen = false;
    dialogState.isNewGroupOpen = false;
    globalDialogManagerMock.mockClear();
  });

  it("does not mount GlobalDialogManager when both dialogs are closed", () => {
    render(<LazyGlobalDialogManager />);
    expect(screen.queryByTestId("global-dialog-manager")).not.toBeInTheDocument();
    expect(globalDialogManagerMock).not.toHaveBeenCalled();
  });

  it("mounts GlobalDialogManager when new chat opens", () => {
    dialogState.isNewChatOpen = true;
    render(<LazyGlobalDialogManager />);
    expect(screen.getByTestId("global-dialog-manager")).toBeInTheDocument();
    expect(globalDialogManagerMock).toHaveBeenCalled();
  });

  it("mounts GlobalDialogManager when new group opens", () => {
    dialogState.isNewGroupOpen = true;
    render(<LazyGlobalDialogManager />);
    expect(screen.getByTestId("global-dialog-manager")).toBeInTheDocument();
  });
});
