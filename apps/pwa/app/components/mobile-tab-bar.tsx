"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MessageSquare, Search, Settings, UserPlus, Users, FolderLock } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/app/lib/utils";
import { NAV_ITEMS } from "../lib/navigation/nav-items";
import { useTranslation } from "react-i18next";

const ICON_BY_HREF: Record<string, any> = {
    "/": MessageSquare,
    "/network": Users,
    "/vault": FolderLock,
    "/search": Search,
    "/requests": Bell,
    "/settings": Settings,
};

interface MobileTabBarProps {
    navBadgeCounts?: Record<string, number>;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ navBadgeCounts = {} }) => {
    const { t } = useTranslation();
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 block border-t border-black/10 bg-white/80 pb-[calc(env(safe-area-inset-bottom)+1.75rem)] pt-2 backdrop-blur-xl dark:border-white/10 dark:bg-black/80 md:hidden">
            <div className="flex items-center justify-around px-2">
                {NAV_ITEMS.map((item) => {
                    const Icon = ICON_BY_HREF[item.href];
                    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                    const badgeCount = navBadgeCounts[item.href] ?? 0;
                    const label = item.i18nKey ? t(item.i18nKey) : item.label;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "relative flex flex-col items-center justify-center gap-1 px-3 py-1 transition-colors",
                                isActive ? "text-purple-600 dark:text-purple-400" : "text-zinc-500 dark:text-zinc-400"
                            )}
                        >
                            <div className="relative">
                                <Icon className={cn("h-6 w-6 transition-transform", isActive && "scale-110")} />
                                {badgeCount > 0 && (
                                    <span className="absolute -right-2 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-black">
                                        {badgeCount > 99 ? "99+" : badgeCount}
                                    </span>
                                )}
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTabGlow"
                                        className="absolute -inset-2 -z-10 rounded-full bg-purple-500/10 blur-sm dark:bg-purple-400/10"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.2 }}
                                    />
                                )}
                            </div>
                            <span className="text-[10px] font-medium leading-none">{label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
};
