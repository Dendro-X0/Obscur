import { describe, expect, it } from "vitest";
import { shouldUseSafeCommunityRenderMode } from "./community-render-mode";

describe("community-render-mode", () => {
    it("enables safe mode when forced explicitly", () => {
        expect(shouldUseSafeCommunityRenderMode({
            forceSafeRenderMode: true,
            reducedMotion: false,
            runtimeConstrained: false,
            isDesktop: false,
        })).toBe(true);
    });

    it("enables safe mode for reduced-motion, constrained, or desktop runtimes", () => {
        expect(shouldUseSafeCommunityRenderMode({
            forceSafeRenderMode: false,
            reducedMotion: true,
            runtimeConstrained: false,
            isDesktop: false,
        })).toBe(true);
        expect(shouldUseSafeCommunityRenderMode({
            forceSafeRenderMode: false,
            reducedMotion: false,
            runtimeConstrained: true,
            isDesktop: false,
        })).toBe(true);
        expect(shouldUseSafeCommunityRenderMode({
            forceSafeRenderMode: false,
            reducedMotion: false,
            runtimeConstrained: false,
            isDesktop: true,
        })).toBe(true);
    });

    it("keeps immersive mode only for non-desktop, non-constrained, motion-enabled rendering", () => {
        expect(shouldUseSafeCommunityRenderMode({
            forceSafeRenderMode: false,
            reducedMotion: false,
            runtimeConstrained: false,
            isDesktop: false,
        })).toBe(false);
    });
});
