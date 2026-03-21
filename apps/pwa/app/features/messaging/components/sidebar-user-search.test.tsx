import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarUserSearch } from "./sidebar-user-search";

const sidebarUserSearchMocks = vi.hoisted(() => ({
  pathname: "/",
  queryResult: [{
    pubkey: "b".repeat(64),
    displayName: "Alice",
    name: "Alice",
    picture: "",
    nip05: undefined,
    trustScore: 0,
    mutuals: [],
  }],
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => sidebarUserSearchMocks.pathname,
}));

vi.mock("../../relays/providers/relay-provider", () => ({
  useRelay: () => ({
    relayPool: {},
  }),
}));

vi.mock("../../auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      publicKeyHex: "a".repeat(64),
    },
  }),
}));

vi.mock("../../search/services/profile-search-service", () => ({
  ProfileSearchService: class {
    async searchByName(): Promise<ReadonlyArray<Readonly<{
      pubkey: string;
      displayName: string;
      name: string;
      picture: string;
      trustScore: number;
      mutuals: ReadonlyArray<string>;
    }>>> {
      return sidebarUserSearchMocks.queryResult;
    }
  },
}));

describe("SidebarUserSearch", () => {
  beforeEach(() => {
    sidebarUserSearchMocks.pathname = "/";
  });

  it("closes open results when dismiss signal changes", async () => {
    const onQueryChange = vi.fn();
    const onUserSelect = vi.fn();
    const view = render(
      <SidebarUserSearch
        query="alice"
        onQueryChange={onQueryChange}
        onUserSelect={onUserSelect}
        dismissSignal="chats:direct"
      />,
    );

    fireEvent.focus(screen.getByTestId("sidebar-unified-search-input"));

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    }, { timeout: 5000 });

    view.rerender(
      <SidebarUserSearch
        query="alice"
        onQueryChange={onQueryChange}
        onUserSelect={onUserSelect}
        dismissSignal="chats:community"
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });
  });

  it("closes open results when clicking outside", async () => {
    render(
      <SidebarUserSearch
        query="alice"
        onQueryChange={vi.fn()}
        onUserSelect={vi.fn()}
        dismissSignal="chats:direct"
      />,
    );

    fireEvent.focus(screen.getByTestId("sidebar-unified-search-input"));

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    }, { timeout: 5000 });

    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText("Alice")).not.toBeInTheDocument();
    });
  });
});
