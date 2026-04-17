import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Lightbox } from "./lightbox";
import type { MediaItem } from "../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
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
  it("renders a PDF preview and navigation controls when adjacent previewable items exist", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();

    render(
      <Lightbox
        item={pdfItem}
        onClose={() => undefined}
        onPrev={onPrev}
        onNext={onNext}
        hasPrev={true}
        hasNext={true}
        activeIndex={1}
        totalItems={3}
      />,
    );

    expect(screen.getByTitle("PDF preview: doc.pdf")).toBeInTheDocument();
    expect(screen.getAllByText("2 / 3")).not.toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it("keeps the sequence controls visible and disables unavailable directions", () => {
    render(
      <Lightbox
        item={pdfItem}
        onClose={() => undefined}
        onNext={() => undefined}
        hasPrev={false}
        hasNext={true}
        activeIndex={0}
        totalItems={2}
      />,
    );

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    expect(screen.getAllByText("1 / 2")).not.toHaveLength(0);
  });
});
