import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileTabBar } from "./mobile-tab-bar";
import * as routeStallRecovery from "./route-stall-recovery.client";

const mobileTabBarMocks = vi.hoisted(() => ({
    pathname: "/",
    push: vi.fn(),
    mobileShellProduct: true,
    beginNavigation: vi.fn(),
}));

vi.mock("@/app/features/runtime/shell-contract", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/app/features/runtime/shell-contract")>();
    return {
        ...actual,
        isMobileShellProduct: () => mobileTabBarMocks.mobileShellProduct,
    };
});

vi.mock("next/navigation", () => ({
    usePathname: () => mobileTabBarMocks.pathname,
    useRouter: () => ({
        push: mobileTabBarMocks.push,
    }),
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

vi.mock("./global-navigation-loading", () => ({
    useGlobalNavigationLoadingActions: () => ({
        beginNavigation: mobileTabBarMocks.beginNavigation,
        beginChunkLoad: vi.fn(),
        endChunkLoad: vi.fn(),
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
        mobileTabBarMocks.mobileShellProduct = true;
    });

    it("renders nav links with href targets", () => {
        render(<MobileTabBar navBadgeCounts={{}} />);

        expect(screen.getByRole("link", { name: "nav.chats" })).toHaveAttribute("href", "/");
        expect(screen.getByRole("link", { name: "nav.network" })).toHaveAttribute("href", "/network");
        expect(screen.getByRole("link", { name: "nav.settings" })).toHaveAttribute("href", "/settings");
    });

    it("soft-pushes immediately and recovers when mobile route transition stalls", async () => {
        vi.useFakeTimers();
        const recoverSpy = vi.spyOn(routeStallRecovery, "recoverFromRouteStall").mockImplementation(() => undefined);
        try {
            render(<MobileTabBar navBadgeCounts={{}} />);
            const networkLink = screen.getByRole("link", { name: "nav.network" });
            act(() => {
                fireEvent.click(networkLink);
            });
            expect(mobileTabBarMocks.push).toHaveBeenCalledWith("/network");
            expect(mobileTabBarMocks.beginNavigation).toHaveBeenCalledWith("/network");
            expect(screen.getByTestId("mobile-tab-bar")).toHaveAttribute("aria-busy", "true");
            expect(networkLink).toHaveAttribute("aria-current", "page");
            expect(recoverSpy).not.toHaveBeenCalled();

            // Mobile shell uses a 6s hard-fallback budget (see ROUTE_NAVIGATION_STALL_HARD_FALLBACK_MS).
            act(() => {
                vi.advanceTimersByTime(6_100);
            });
            expect(recoverSpy).toHaveBeenCalledWith("/network", expect.objectContaining({ push: expect.any(Function) }));
        } finally {
            recoverSpy.mockRestore();
            vi.useRealTimers();
        }
    });

    it("hides outside the mobile product shell (desktop-first)", () => {
        mobileTabBarMocks.mobileShellProduct = false;
        render(<MobileTabBar navBadgeCounts={{}} />);
        expect(screen.queryByTestId("mobile-tab-bar")).not.toBeInTheDocument();
    });

    it("stays visible on mobile shell builds", () => {
        mobileTabBarMocks.mobileShellProduct = true;
        render(<MobileTabBar navBadgeCounts={{}} />);
        expect(screen.getByTestId("mobile-tab-bar")).toBeInTheDocument();
    });

    it("clears hard fallback when pathname settles to target", () => {
        vi.useFakeTimers();
        const recoverSpy = vi.spyOn(routeStallRecovery, "recoverFromRouteStall").mockImplementation(() => undefined);
        try {
            const { rerender } = render(<MobileTabBar navBadgeCounts={{}} />);
            const networkLink = screen.getByRole("link", { name: "nav.network" });
            act(() => {
                fireEvent.click(networkLink);
            });

            mobileTabBarMocks.pathname = "/network";
            rerender(<MobileTabBar navBadgeCounts={{}} />);

            act(() => {
                vi.advanceTimersByTime(6_100);
            });
            expect(recoverSpy).not.toHaveBeenCalled();
        } finally {
            recoverSpy.mockRestore();
            vi.useRealTimers();
        }
    });
});
