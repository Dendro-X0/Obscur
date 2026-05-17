import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Preloader, preloaderInternals } from "./preloader";

describe("Preloader", () => {
    const originalFonts = (document as Document & { fonts?: FontFaceSet }).fonts;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.className = "";
        document.body.style.visibility = "hidden";
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.className = "";
        document.body.style.removeProperty("visibility");
        if (originalFonts === undefined) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            delete (document as any).fonts;
            return;
        }
        Object.defineProperty(document, "fonts", {
            configurable: true,
            writable: true,
            value: originalFonts,
        });
    });

    it("does not hide body visibility during warm-up", () => {
        render(<Preloader />);

        expect(document.body.classList.contains("preloading")).toBe(true);
        expect(document.body.style.visibility).toBe("");
    });

    it("releases preloading class after bounded warm-up timeout", async () => {
        Object.defineProperty(document, "fonts", {
            configurable: true,
            writable: true,
            value: {
                ready: new Promise(() => {
                    // intentionally unresolved
                }),
            },
        });

        render(<Preloader />);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(
                preloaderInternals.PRELOADER_TIMEOUT_MS + preloaderInternals.PRELOADER_SETTLE_DELAY_MS + 20
            );
            await Promise.resolve();
        });

        expect(document.body.classList.contains("preloading")).toBe(false);
        expect(document.body.style.visibility).toBe("");
    });
});
