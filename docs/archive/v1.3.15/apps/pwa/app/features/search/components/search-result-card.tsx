"use client";

import React from "react";
import { Avatar, AvatarFallback } from "@dweb/ui-kit";
import { User, Users, PlusCircle, ChevronRight, UserPlus, Globe } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import Image from "next/image";
import { cn } from "@dweb/ui-kit";
import { useRouter } from "next/navigation";
import type { DiscoveryResult } from "@/app/features/search/types/discovery";
import { getPublicGroupHref, getPublicProfileHref } from "@/app/features/navigation/public-routes";
import { useResolvedProfileMetadata } from "@/app/features/profile/hooks/use-resolved-profile-metadata";
import { discoverySessionDiagnosticsStore } from "@/app/features/search/services/discovery-session-diagnostics";

interface SearchResultCardProps {
    result: DiscoveryResult;
    onClick?: (result: DiscoveryResult) => void;
    onAdd?: (result: DiscoveryResult) => void;
}

export function SearchResultCard({ result, onClick, onAdd }: SearchResultCardProps) {
    const router = useRouter();
    const resolvedMetadata = useResolvedProfileMetadata(result.display.pubkey ?? null);
    const resolvedTitle = resolvedMetadata.displayName || result.display.title || result.display.pubkey || "Unknown";
    const resolvedPicture = resolvedMetadata.avatarUrl || result.display.picture;
    const resolvedDescription = resolvedMetadata.about || result.display.description;
    const resolvedSubtitle = result.kind === "community"
        ? result.display.subtitle
        : (resolvedMetadata.nip05 || result.display.subtitle);
    const rawIdentifier = result.display.pubkey || result.display.communityId || result.display.relayUrl || "";

    const handleClick = () => {
        if (onClick) {
            onClick(result);
        } else {
            if ((result.kind === "person" || result.kind === "invite" || result.kind === "contact_card") && result.display.pubkey) {
                router.push(getPublicProfileHref(result.display.pubkey));
            } else if (result.kind === "community" && result.display.communityId) {
                router.push(getPublicGroupHref(result.display.communityId, result.display.relayUrl));
            }
        }
    };

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        discoverySessionDiagnosticsStore.recordAddContactConversion({ result });
        if (onAdd) {
            onAdd(result);
        } else if (result.display.pubkey) {
            router.push(getPublicProfileHref(result.display.pubkey));
        }
    };

    const getIcon = () => {
        switch (result.kind) {
            case "community":
                return <Users className="h-5 w-5 text-muted-foreground" />;
            case "person":
                return <User className="h-5 w-5 text-muted-foreground" />;
            case "invite":
                return <PlusCircle className="h-5 w-5 text-muted-foreground" />;
            case "contact_card":
                return <Globe className="h-5 w-5 text-muted-foreground" />;
            default:
                return <User className="h-5 w-5 text-muted-foreground" />;
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(e) => {
                if (e.key === 'Enter') handleClick();
            }}
            className="group relative flex items-center gap-3 rounded-2xl border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] p-3 shadow-[0_14px_36px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_24px_60px_rgba(79,70,229,0.12)] active:scale-[0.995] sm:gap-4 sm:rounded-[28px] sm:p-4 dark:bg-[linear-gradient(180deg,rgba(10,16,34,0.92),rgba(7,12,24,0.94))]"
        >
            <div className="relative">
                <Avatar className="h-12 w-12 border border-border/70 bg-muted shadow-sm transition-colors group-hover:border-primary/40 sm:h-14 sm:w-14">
                    {resolvedPicture ? (
                        <Image
                            src={resolvedPicture}
                            alt={resolvedTitle}
                            width={56}
                            height={56}
                            className="object-cover"
                        />
                    ) : (
                        <AvatarFallback className="bg-muted">
                            {getIcon()}
                        </AvatarFallback>
                    )}
                </Avatar>

                {(result.kind === "person" || result.kind === "invite" || result.kind === "contact_card") && (
                    <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary opacity-0 transition-opacity group-hover:opacity-100">
                        <PlusCircle className="h-3 w-3 text-primary-foreground" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-black text-foreground transition-colors group-hover:text-primary sm:text-base">
                        {resolvedTitle}
                    </h4>
                    {result.confidence === "direct" && (
                        <span className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary/70">
                            Direct
                        </span>
                    )}
                </div>

                {resolvedSubtitle && resolvedSubtitle !== resolvedTitle && (
                    <p className="truncate text-sm font-medium text-muted-foreground/80">
                        {result.kind === "community" ? resolvedSubtitle : `@${resolvedSubtitle}`}
                    </p>
                )}

                <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground opacity-60">
                    {rawIdentifier}
                </p>

                {resolvedDescription && (
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground/75">
                        {resolvedDescription}
                    </p>
                )}
            </div>

            <div className="flex translate-x-0 items-center gap-2 opacity-100 transition-all duration-300 sm:translate-x-2 sm:opacity-0 sm:group-hover:translate-x-0 sm:group-hover:opacity-100">
                {(result.kind === "person" || result.kind === "invite" || result.kind === "contact_card") && (
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleAdd}
                        className="h-8 w-8 rounded-xl bg-primary/10 text-primary transition-all hover:bg-primary hover:text-primary-foreground sm:h-9 sm:w-9"
                    >
                        <UserPlus className="h-4 w-4" />
                    </Button>
                )}
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground transition-all group-hover:bg-primary/10 group-hover:text-primary sm:h-9 sm:w-9">
                    <ChevronRight className="h-5 w-5" />
                </div>
            </div>

            <div className="absolute right-4 top-2">
                <span className={cn(
                    "rounded-full px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.2em]",
                    result.kind === "community" ? "bg-amber-500/10 text-amber-600 dark:text-amber-300" : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                )}>
                    {result.kind === "community" ? "Community" : "Profile"}
                </span>
            </div>
        </div>
    );
}
