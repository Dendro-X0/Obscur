"use client";

import { useEffect } from "react";

/**
 * Preloader - Forces CSS and critical resources to load before showing the UI
 * Prevents flash of unstyled content (FOUC) in both PWA and Desktop builds
 */
export const Preloader = () => {
    useEffect(() => {
        const warmUp = async (): Promise<void> => {
            // Wait for fonts to load
            if (document.fonts) {
                await document.fonts.ready;
            }

            // Wait for stylesheets
            const styleSheets = Array.from(document.styleSheets);
            await Promise.all(
                styleSheets.map(async (sheet) => {
                    try {
                        // Access rules to force load
                        void sheet.cssRules;
                    } catch {
                        // External sheets might throw CORS
                    }
                })
            );

            // Small delay to ensure rendering is complete
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Remove loading state
            document.body.classList.remove("preloading");
            document.body.style.visibility = "visible";
        };

        // Set initial loading state
        document.body.classList.add("preloading");
        document.body.style.visibility = "hidden";

        void warmUp();
    }, []);

    return null;
};
