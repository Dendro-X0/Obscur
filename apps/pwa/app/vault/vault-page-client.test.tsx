import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import VaultPageClient from "./vault-page-client";

const vaultPageMocks = vi.hoisted(() => ({
  compactLayout: true,
  publicKeyHex: "a".repeat(64),
  lesNative: true,
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

vi.mock("@/app/features/les/sdk/les-native-sdk", () => ({
  isLesNativeAvailable: () => vaultPageMocks.lesNative,
}));

vi.mock("@/app/features/les/ui/use-les-vault-media", () => ({
  useLesVaultMedia: () => ({
    mediaItems: [],
    isLoading: false,
    error: null,
    refresh: vi.fn(),
    downloadToLocalPath: vi.fn(async () => true),
    deleteLocalCopy: vi.fn(async () => undefined),
    openLocalFileLocation: vi.fn(async () => true),
    stats: { imageCount: 0, videoCount: 0, audioCount: 0, fileCount: 0, total: 0 },
    available: true,
  }),
}));

vi.mock("@/app/features/vault/components/vault-media-grid", () => ({
  VaultMediaGrid: () => <div data-testid="vault-media-grid" />,
}));

vi.mock("@/app/features/les/ui/les-upload-modal", () => ({
  LesUploadModal: () => null,
}));

vi.mock("@dweb/ui-kit", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
  Card: ({
    children,
    title,
    description,
    ...props
  }: React.HTMLAttributes<HTMLDivElement> & { title?: string; description?: string }) => (
    <div {...props}>
      {title ? <h2>{title}</h2> : null}
      {description ? <p>{description}</p> : null}
      {children}
    </div>
  ),
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
}));

describe("VaultPageClient LES + VaultMediaGrid (R6)", () => {
  beforeEach(() => {
    vaultPageMocks.compactLayout = true;
    vaultPageMocks.publicKeyHex = "a".repeat(64);
    vaultPageMocks.lesNative = true;
  });

  it("uses VaultMediaGrid inside LES scroll region on native", () => {
    render(<VaultPageClient />);

    expect(screen.getByTestId("vault-les-scroll-region")).toHaveClass("mobile-scroll-region");
    expect(screen.getByRole("button", { name: /vault\.upload/i }).className).toContain("min-h-[44px]");
    expect(screen.getByTestId("vault-media-grid")).toBeInTheDocument();
  });

  it("shows desktop-required copy when LES is unavailable", () => {
    vaultPageMocks.lesNative = false;
    render(<VaultPageClient />);
    expect(screen.getByText(/requires the Obscur desktop app/i)).toBeInTheDocument();
  });
});
