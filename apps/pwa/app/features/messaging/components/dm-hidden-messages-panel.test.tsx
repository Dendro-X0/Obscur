import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "../types";
import { DmHiddenMessagesPanel } from "./dm-hidden-messages-panel";
import en from "@/app/lib/i18n/locales/en.json";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template = (en.translation as Record<string, string | undefined>)[key] ?? key;
      return template.replace(/\{\{\s*([^\s}]+)\s*\}\}/g, (_match, token: string) => String(options?.[token] ?? ""));
    },
  }),
}));

const hiddenMessage: Message = {
  id: "hidden-1",
  kind: "user",
  content: "secret note",
  timestamp: new Date(5_000),
  isOutgoing: true,
  status: "delivered",
  conversationId: "conv-1",
};

describe("DmHiddenMessagesPanel", () => {
  it("renders toggle and calls show-again handlers", () => {
    const onShowAgain = vi.fn();
    const onShowAllAgain = vi.fn();

    render(
      <DmHiddenMessagesPanel
        hiddenMessages={[hiddenMessage]}
        isOpen
        onOpenChange={vi.fn()}
        onShowAgain={onShowAgain}
        onShowAllAgain={onShowAllAgain}
      />,
    );

    expect(screen.getByRole("button", { expanded: true })).toHaveTextContent(/Hidden on this device/i);
    fireEvent.click(screen.getByRole("button", { name: /Show again on this device/i }));
    expect(onShowAgain).toHaveBeenCalledWith(hiddenMessage);

    fireEvent.click(screen.getByRole("button", { name: /Show all again on this device/i }));
    expect(onShowAllAgain).toHaveBeenCalledTimes(1);
  });
});
