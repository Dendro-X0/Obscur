"use client";

import { useEffect } from "react";

const PRELOADER_TIMEOUT_MS = 1500;

/**
 * Preloader - Forces CSS and critical resources to load before showing the UI
 * Prevents flash of unstyled content (FOUC) in both PWA and Desktop builds
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
            document.body.style.visibility = "visible";
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

            await new Promise((resolve) => window.setTimeout(resolve, 100));
            releaseBody();
        };

        document.body.classList.add("preloading");
        document.body.style.visibility = "hidden";

        void warmUp();

        const fallbackTimeout = window.setTimeout(releaseBody, PRELOADER_TIMEOUT_MS + 250);

        return () => {
            window.clearTimeout(fallbackTimeout);
            releaseBody();
        };
    }, []);

    return null;
};
