import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileTabBar } from "./mobile-tab-bar";
import * as pageTransitionRecovery from "./page-transition-recovery";

const mobileTabBarMocks = vi.hoisted(() => ({
    pathname: "/",
}));

vi.mock("next/navigation", () => ({
    usePathname: () => mobileTabBarMocks.pathname,
}));

vi.mock("next/link", () => ({
    default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }) => {
        const { href, onClick, children, ...rest } = props;
        return (
            <a
                href={typeof href === "string" ? href : ""}
                onClick={(event) => {
                    onClick?.(event);
                    event.preventDefault();
                }}
                {...rest}
            >
                {children}
            </a>
        );
    },
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
    }),
}));

vi.mock("framer-motion", () => ({
    motion: {
        div: (props: React.HTMLAttributes<HTMLDivElement> & Record<string, unknown>) => {
            const { layoutId, initial, animate, transition, ...rest } = props;
            void layoutId;
            void initial;
            void animate;
            void transition;
            return <div {...rest} />;
        },
    },
}));

vi.mock("@/app/shared/log-app-event", () => ({
    logAppEvent: vi.fn(),
}));

describe("MobileTabBar navigation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mobileTabBarMocks.pathname = "/";
    });

    it("renders nav links with href targets", () => {
        render(<MobileTabBar navBadgeCounts={{}} />);

        expect(screen.getByRole("link", { name: "nav.chats" })).toHaveAttribute("href", "/");
        expect(screen.getByRole("link", { name: "nav.network" })).toHaveAttribute("href", "/network");
        expect(screen.getByRole("link", { name: "nav.settings" })).toHaveAttribute("href", "/settings");
    });

    it("hard-navigates when mobile route transition stalls", () => {
        vi.useFakeTimers();
        const hardNavigateSpy = vi.spyOn(pageTransitionRecovery, "hardNavigate").mockImplementation(() => undefined);
        try {
            render(<MobileTabBar navBadgeCounts={{}} />);
            const networkLink = screen.getByRole("link", { name: "nav.network" });
            act(() => {
                fireEvent.click(networkLink);
            });
            expect(hardNavigateSpy).not.toHaveBeenCalled();

            act(() => {
                vi.advanceTimersByTime(4_600);
            });
            expect(hardNavigateSpy).toHaveBeenCalledWith("/network");
        } finally {
            hardNavigateSpy.mockRestore();
            vi.useRealTimers();
        }
    });

    it("clears hard fallback when pathname settles to target", () => {
        vi.useFakeTimers();
        const hardNavigateSpy = vi.spyOn(pageTransitionRecovery, "hardNavigate").mockImplementation(() => undefined);
        try {
            const { rerender } = render(<MobileTabBar navBadgeCounts={{}} />);
            const networkLink = screen.getByRole("link", { name: "nav.network" });
            act(() => {
                fireEvent.click(networkLink);
            });

            mobileTabBarMocks.pathname = "/network";
            rerender(<MobileTabBar navBadgeCounts={{}} />);

            act(() => {
                vi.advanceTimersByTime(4_600);
            });
            expect(hardNavigateSpy).not.toHaveBeenCalled();
        } finally {
            hardNavigateSpy.mockRestore();
            vi.useRealTimers();
        }
    });
});
