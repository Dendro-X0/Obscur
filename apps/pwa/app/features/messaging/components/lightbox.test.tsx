import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppOverlayRoot, APP_OVERLAY_ROOT_ID } from "@/app/components/app-overlay-layer";
import { Lightbox } from "./lightbox";
import type { MediaItem } from "../types";
import en from "@/app/lib/i18n/locales/en.json";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const template = (en.translation as Record<string, string | undefined>)[key] ?? key;
      return template.replace(/\{\{\s*([^\s}]+)\s*\}\}/g, (_match, token: string) => String(options?.[token] ?? ""));
    },
  }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt ?? ""} />,
}));

vi.mock("./audio-player", () => ({
  AudioPlayer: () => <div data-testid="audio-player" />,
}));

vi.mock("./video-player", () => ({
  VideoPlayer: () => <div data-testid="video-player" />,
}));

vi.mock("@/app/features/messaging/services/voice-note-metadata", () => ({
  getVoiceNoteAttachmentMetadata: () => null,
  parseVoiceNoteFileName: () => ({ isVoiceNote: false }),
}));

vi.mock("../../settings/services/privacy-settings-service", () => ({
  PrivacySettingsService: {
    getSettings: () => ({ chatUxV083: true }),
  },
}));

vi.mock("@/app/features/vault/services/local-media-store", () => ({
  downloadAttachmentToUserPath: vi.fn(async () => true),
}));

vi.mock("../hooks/use-attachment-export-gate", () => ({
  useAttachmentExportGate: () => ({
    pendingExportFileName: null,
    cancelExportConfirm: vi.fn(),
    confirmExport: vi.fn(),
    runExportWithGate: vi.fn(async (_item: MediaItem, runExport: () => Promise<void>) => {
      await runExport();
    }),
  }),
}));

const pdfItem: MediaItem = {
  messageId: "m-pdf",
  timestamp: new Date(1_000),
  attachment: {
    kind: "file",
    url: "https://cdn.example.com/doc.pdf",
    contentType: "application/pdf",
    fileName: "doc.pdf",
  },
};

describe("Lightbox preview navigation", () => {
  it("renders through the app overlay root above the app shell stacking context", () => {
    render(
      <>
        <AppOverlayRoot />
        <Lightbox
          item={pdfItem}
          onClose={() => undefined}
        />
      </>,
    );

    const overlayRoot = document.getElementById(APP_OVERLAY_ROOT_ID);
    const backdrop = overlayRoot?.querySelector('[data-escape-layer="open"]');
    expect(backdrop).not.toBeNull();
    expect(backdrop?.className).toContain("z-[10100]");
    expect(backdrop?.className).toContain("bg-black/75");
  });

  it("renders a PDF preview and navigation controls when adjacent previewable items exist", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    render(
      <>
        <AppOverlayRoot />
        <Lightbox
          item={pdfItem}
          onClose={() => undefined}
          onPrev={onPrev}
          onNext={onNext}
          hasPrev={true}
          hasNext={true}
          activeIndex={1}
          totalItems={3}
        />
      </>,
    );

    expect(screen.getByTitle("PDF preview: doc.pdf")).toBeInTheDocument();
    expect(screen.getAllByText("2 / 3")).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Previous", hidden: true }));
    fireEvent.click(screen.getByRole("button", { name: "Next", hidden: true }));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("keeps the sequence controls visible and disables unavailable directions", () => {
    render(
      <>
        <AppOverlayRoot />
        <Lightbox
          item={pdfItem}
          onClose={() => undefined}
          onNext={() => undefined}
          hasPrev={false}
          hasNext={true}
          activeIndex={0}
          totalItems={2}
        />
      </>,
    );

    expect(screen.getByRole("button", { name: "Previous", hidden: true })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next", hidden: true })).toBeEnabled();
    expect(screen.getAllByText("1 / 2")).not.toHaveLength(0);
  });
});
