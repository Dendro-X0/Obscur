import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ChatRouteMainShell } from "./chat-route-main-shell";

const pathnameRef = { current: "/" };

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

vi.mock("@/app/features/main-shell/main-shell", () => ({
  default: () => <div data-testid="main-shell" />,
}));

describe("ChatRouteMainShell", () => {
  it("mounts MainShell only on the chat route", () => {
    pathnameRef.current = "/";
    const chat = render(<ChatRouteMainShell />);
    expect(chat.getByTestId("main-shell")).toBeTruthy();
    expect(chat.getByTestId("main-shell").parentElement?.dataset.chatRouteActive).toBe("true");
    chat.unmount();

    pathnameRef.current = "/network";
    const network = render(<ChatRouteMainShell />);
    expect(network.queryByTestId("main-shell")).toBeNull();
  });
});
