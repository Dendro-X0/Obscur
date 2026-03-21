"use client";

import { useEffect } from "react";

const PRELOADER_TIMEOUT_MS = 1500;
const PRELOADER_SETTLE_DELAY_MS = 100;

export const preloaderInternals = {
    PRELOADER_TIMEOUT_MS,
    PRELOADER_SETTLE_DELAY_MS,
} as const;

/**
 * Preloader - best-effort warm-up for fonts/styles without owning first paint.
 * Startup visibility must remain fail-open so stalled hydration cannot blank the app.
 */
export const Preloader = () => {
    useEffect(() => {
        let released = false;

        const releaseBody = (): void => {
            if (released) {
                return;
            }
            released = true;
            document.body.classList.remove("preloading");
            document.body.style.removeProperty("visibility");
        };

        const warmUp = async (): Promise<void> => {
            const boundedTasks: Promise<unknown>[] = [];

            if (document.fonts) {
                boundedTasks.push(document.fonts.ready.catch(() => undefined));
            }

            const styleSheets = Array.from(document.styleSheets);
            boundedTasks.push(Promise.all(
                styleSheets.map(async (sheet) => {
                    try {
                        void sheet.cssRules;
                    } catch {
                        return;
                    }
                })
            ));

            await Promise.race([
                Promise.allSettled(boundedTasks),
                new Promise((resolve) => window.setTimeout(resolve, PRELOADER_TIMEOUT_MS)),
            ]);

            await new Promise((resolve) => window.setTimeout(resolve, PRELOADER_SETTLE_DELAY_MS));
            releaseBody();
        };

        document.body.classList.add("preloading");
        // Keep first-paint visible even if boot work hangs after hydration.
        document.body.style.removeProperty("visibility");

        void warmUp();

        const fallbackTimeout = window.setTimeout(releaseBody, PRELOADER_TIMEOUT_MS + 250);

        return () => {
            window.clearTimeout(fallbackTimeout);
            releaseBody();
        };
    }, []);

    return null;
};
