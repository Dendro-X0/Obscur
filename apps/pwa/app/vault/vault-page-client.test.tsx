import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VaultPageClient from "./vault-page-client";

const vaultPageMocks = vi.hoisted(() => ({
  compactLayout: true,
  publicKeyHex: "a".repeat(64),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/app/features/runtime/use-mobile-compact-layout", () => ({
  useMobileCompactLayout: () => vaultPageMocks.compactLayout,
  useTabletSecondaryLayout: () => false,
}));

vi.mock("@/app/components/app-chrome-registry", () => ({
  useRegisterAppChrome: vi.fn(),
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      publicKeyHex: vaultPageMocks.publicKeyHex,
      stored: { publicKeyHex: vaultPageMocks.publicKeyHex },
    },
  }),
}));

vi.mock("@/app/features/main-shell/hooks/use-nav-badges", () => ({
  default: () => ({
    navBadgeCounts: {},
  }),
}));

vi.mock("@/app/features/vault/hooks/use-vault-media", () => ({
  useVaultMedia: () => ({
    mediaItems: [],
    isLoading: false,
    stats: { imageCount: 0, videoCount: 0, audioCount: 0, fileCount: 0, total: 0 },
    refresh: vi.fn(),
    downloadToLocalPath: vi.fn(async () => true),
    deleteLocalCopy: vi.fn(async () => undefined),
    openLocalFileLocation: vi.fn(async () => true),
    pendingExportFileName: null,
    cancelExportConfirm: vi.fn(),
    confirmExport: vi.fn(async () => true),
  }),
}));

vi.mock("@/app/features/vault/components/vault-media-grid", () => ({
  VaultMediaGrid: () => <div data-testid="vault-media-grid" />,
}));

vi.mock("@/app/features/vault/components/vault-upload-modal", () => ({
  VaultUploadModal: () => null,
}));

vi.mock("@dweb/ui-kit", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

describe("VaultPageClient compact layout", () => {
  beforeEach(() => {
    vaultPageMocks.compactLayout = true;
    vaultPageMocks.publicKeyHex = "a".repeat(64);
  });

  it("uses contained scroll and a mobile scroll region for the grid", () => {
    render(<VaultPageClient />);

    expect(screen.getByTestId("vault-mobile-scroll-region")).toHaveClass("mobile-scroll-region");
    expect(screen.getByRole("button", { name: /vault\.upload/i }).className).toContain("min-h-[44px]");
    expect(screen.getByTestId("vault-media-grid")).toBeInTheDocument();
  });
});
