import { describe, expect, it, vi } from "vitest";
import type { Attachment } from "../types";
import { getAttachmentContextMenuTriggerProps } from "./attachment-context-menu-handlers";

const attachment: Attachment = {
    kind: "audio",
    url: "https://cdn.example.com/track.mp3",
    contentType: "audio/mpeg",
    fileName: "track.mp3",
};

describe("getAttachmentContextMenuTriggerProps", () => {
    it("opens the attachment menu on touch long-press", () => {
        vi.useFakeTimers();
        const onOpen = vi.fn();
        const props = getAttachmentContextMenuTriggerProps(attachment, onOpen);
        const element = document.createElement("div");
        const pointerDown = {
            pointerType: "touch",
            clientX: 120,
            clientY: 240,
            currentTarget: element,
            stopPropagation: vi.fn(),
        } as unknown as React.PointerEvent<HTMLElement>;
        props.onPointerDown(pointerDown);
        vi.advanceTimersByTime(420);
        expect(onOpen).toHaveBeenCalledWith({
            attachment,
            x: 120,
            y: 240,
        });
        vi.useRealTimers();
    });
});
