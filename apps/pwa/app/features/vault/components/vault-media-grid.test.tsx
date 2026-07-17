import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VaultMediaGrid } from "./vault-media-grid";
import type { VaultMediaItem } from "../hooks/use-vault-media";

const vaultGridTranslations: Record<string, string> = {
  "vault.origin.direct": "Direct message",
  "vault.origin.community": "Community",
  "vault.origin.chat": "Chat",
  "vault.origin.directSource": "Direct message source",
  "vault.origin.communitySource": "Community source",
  "vault.origin.chatSource": "Chat source",
  "vault.actions.openDirectMessage": "Open Direct Message",
  "vault.actions.openCommunity": "Open Community",
  "vault.actions.openSourceChat": "Open Source Chat",
  "vault.actions.exportDecryptedCopy": "Export decrypted copy…",
  "vault.actions.openVaultFolder": "Open vault folder",
  "vault.actions.removeFromVault": "Remove from Vault",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => vaultGridTranslations[key] ?? fallback ?? key,
  }),
}));

vi.mock("@dweb/ui-kit", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { onSelect?: () => void }) => (
    <button type="button" {...props} onClick={() => onSelect?.()}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />,
}));

vi.mock("@/app/components/app-overlay-layer", () => ({
  APP_OVERLAY_BACKDROP_CLASS: "overlay-backdrop",
  AppOverlayPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/app/lib/utils", () => ({
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

vi.mock("framer-motion", () => {
  const MockMotionDiv = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    function MockMotionDiv({ children, ...props }, ref) {
      return (
        <div ref={ref} {...props}>
          {children}
        </div>
      );
    },
  );

  return {
    motion: {
      div: MockMotionDiv,
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useMotionValue: () => ({ set: vi.fn(), get: () => 0 }),
    useSpring: (value: unknown) => value,
    useTransform: () => 0,
  };
});

const createMediaItem = (overrides: Partial<VaultMediaItem> = {}): VaultMediaItem => ({
  id: "item-1",
  messageId: "message-1",
  timestamp: new Date("2026-04-10T00:00:00.000Z"),
  remoteUrl: "https://cdn.example.com/item-1.png",
  isLocalCached: false,
  localRelativePath: null,
  sourceConversationId: "dm:self:peer-a",
  attachment: {
    kind: "image",
    url: "https://cdn.example.com/item-1.png",
    fileName: "sunset.png",
    contentType: "image/png",
  },
  ...overrides,
});

const vaultGridRoutingMocks = vi.hoisted(() => ({
  push: vi.fn(),
  compactLayout: false,
}));

vi.mock("@/app/features/runtime/use-mobile-compact-layout", () => ({
  useMobileCompactLayout: () => vaultGridRoutingMocks.compactLayout,
  useTabletSecondaryLayout: () => false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vaultGridRoutingMocks.push,
  }),
}));

describe("VaultMediaGrid management actions", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vaultGridRoutingMocks.push.mockReset();
    vaultGridRoutingMocks.compactLayout = false;
  });

  it("removes an item into the dedicated Removed filter and allows restoring it", () => {
    const item = createMediaItem();

    render(
      <VaultMediaGrid
        mediaItems={[item]}
        isLoading={false}
        stats={{ imageCount: 1, videoCount: 0, audioCount: 0, fileCount: 0, total: 1 }}
        refresh={() => undefined}
        downloadToLocalPath={async () => true}
        deleteLocalCopy={async () => undefined}
      />,
    );

    expect(screen.getByText("Direct message")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(`Vault item actions for ${item.attachment.fileName}`));
    fireEvent.click(screen.getByText("Remove from Vault"));

    expect(screen.getByText("Removed (1)")).toBeInTheDocument();
    expect(screen.getByText("No items found in this section.")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Removed (1)"));
    expect(screen.getByText(item.attachment.fileName)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(`Vault item actions for ${item.attachment.fileName}`));
    fireEvent.click(screen.getByText("Restore to Vault"));

    expect(screen.getByText("Removed (0)")).toBeInTheDocument();
    fireEvent.click(screen.getByText("All (1)"));
    expect(screen.getByText(item.attachment.fileName)).toBeInTheDocument();
  });

  it("migrates legacy hidden items into the Removed filter", () => {
    const item = createMediaItem();
    window.localStorage.setItem("obscur.vault.hidden", JSON.stringify([item.id]));
    window.localStorage.setItem("obscur.vault.filter.preference", "hidden");

    render(
      <VaultMediaGrid
        mediaItems={[item]}
        isLoading={false}
        stats={{ imageCount: 1, videoCount: 0, audioCount: 0, fileCount: 0, total: 1 }}
        refresh={() => undefined}
        downloadToLocalPath={async () => true}
        deleteLocalCopy={async () => undefined}
      />,
    );

    expect(screen.getByText("Removed (1)")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search removed Vault media")).toBeInTheDocument();
    expect(screen.getByText(item.attachment.fileName)).toBeInTheDocument();
  });

  it("filters and sorts Vault items for easier browsing", () => {
    const newerItem = createMediaItem({
      id: "item-2",
      messageId: "message-2",
      timestamp: new Date("2026-04-11T00:00:00.000Z"),
      remoteUrl: "https://cdn.example.com/voice-note.mp3",
      attachment: {
        kind: "audio",
        url: "https://cdn.example.com/voice-note.mp3",
        fileName: "voice-note.mp3",
        contentType: "audio/mpeg",
      },
    });
    const olderItem = createMediaItem({
      id: "item-1",
      timestamp: new Date("2026-04-09T00:00:00.000Z"),
      attachment: {
        kind: "image",
        url: "https://cdn.example.com/alpha-image.png",
        fileName: "alpha-image.png",
        contentType: "image/png",
      },
    });

    render(
      <VaultMediaGrid
        mediaItems={[olderItem, newerItem]}
        isLoading={false}
        stats={{ imageCount: 1, videoCount: 0, audioCount: 1, fileCount: 0, total: 2 }}
        refresh={() => undefined}
        downloadToLocalPath={async () => true}
        deleteLocalCopy={async () => undefined}
      />,
    );

    const search = screen.getByPlaceholderText("Search Vault media");
    fireEvent.change(search, { target: { value: "voice" } });
    expect(screen.getByText("voice-note.mp3")).toBeInTheDocument();
    expect(screen.queryByText("alpha-image.png")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Sort Vault media: Newest first"));
    fireEvent.click(screen.getByRole("option", { name: "File name" }));

    const fileNames = screen.getAllByText(/\.png$|\.mp3$/).map((node) => node.textContent);
    expect(fileNames[0]).toBe("alpha-image.png");
    expect(fileNames[1]).toBe("voice-note.mp3");
  });

  it("routes a Vault item back to its source conversation", () => {
    const item = createMediaItem({ sourceConversationId: "community:relay.example:group-1" });

    render(
      <VaultMediaGrid
        mediaItems={[item]}
        isLoading={false}
        stats={{ imageCount: 1, videoCount: 0, audioCount: 0, fileCount: 0, total: 1 }}
        refresh={() => undefined}
        downloadToLocalPath={async () => true}
        deleteLocalCopy={async () => undefined}
      />,
    );

    expect(screen.getByText("Community")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(`Vault item actions for ${item.attachment.fileName}`));
    fireEvent.click(screen.getByText("Open Community"));

    expect(vaultGridRoutingMocks.push).toHaveBeenCalledWith("/?convId=community%3Arelay.example%3Agroup-1");
  });

  it("uses source-specific copy in the preview footer", async () => {
    const item = createMediaItem();

    render(
      <VaultMediaGrid
        mediaItems={[item]}
        isLoading={false}
        stats={{ imageCount: 1, videoCount: 0, audioCount: 0, fileCount: 0, total: 1 }}
        refresh={() => undefined}
        downloadToLocalPath={async () => true}
        deleteLocalCopy={async () => undefined}
      />,
    );

    const sourceBadge = screen.getByText("Direct message");
    const tile = sourceBadge.closest('[role="button"]');
    expect(tile).not.toBeNull();
    fireEvent.keyDown(tile!, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getAllByText("Open Direct Message").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Direct message source").length).toBeGreaterThan(0);
  });

  it("exports a Vault item from the action menu", async () => {
    const item = createMediaItem();
    const downloadToLocalPath = vi.fn(async () => true);

    render(
      <VaultMediaGrid
        mediaItems={[item]}
        isLoading={false}
        stats={{ imageCount: 1, videoCount: 0, audioCount: 0, fileCount: 0, total: 1 }}
        refresh={() => undefined}
        downloadToLocalPath={downloadToLocalPath}
        deleteLocalCopy={async () => undefined}
      />,
    );

    fireEvent.click(screen.getByLabelText(`Vault item actions for ${item.attachment.fileName}`));
    fireEvent.click(screen.getByText("Export decrypted copy…"));

    await waitFor(() => {
      expect(downloadToLocalPath).toHaveBeenCalledWith(expect.objectContaining({ id: item.id }));
    });
  });
});

describe("VaultMediaGrid compact touch targets", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vaultGridRoutingMocks.compactLayout = true;
  });

  it("uses compact filter rail and 44px-class touch targets", () => {
    const item = createMediaItem();

    render(
      <VaultMediaGrid
        mediaItems={[item]}
        isLoading={false}
        stats={{ imageCount: 1, videoCount: 0, audioCount: 0, fileCount: 0, total: 1 }}
        refresh={() => undefined}
        downloadToLocalPath={async () => true}
        deleteLocalCopy={async () => undefined}
      />,
    );

    const filterRail = screen.getByTestId("vault-compact-filters");
    expect(filterRail).toHaveClass("mobile-scroll-region");

    const imageFilter = screen.getByRole("button", { name: /Images/i });
    expect(imageFilter.className).toContain("min-h-[44px]");

    const menuButton = screen.getByLabelText(`Vault item actions for ${item.attachment.fileName}`);
    expect(menuButton.className).toContain("h-11");
  });
});
