"use client";

import React from "react";
import { Avatar, AvatarFallback } from "@dweb/ui-kit";
import { User, Users, PlusCircle, MessageSquare, ChevronRight, UserPlus, Globe } from "lucide-react";
import { Button } from "@dweb/ui-kit";
import Image from "next/image";
import { cn } from "@dweb/ui-kit";
import { useRouter } from "next/navigation";
import type { SearchResult } from "../hooks/use-global-search";

interface SearchResultCardProps {
    result: SearchResult;
    onClick?: (result: SearchResult) => void;
    onAdd?: (result: SearchResult) => void;
}

export function SearchResultCard({ result, onClick, onAdd }: SearchResultCardProps) {
    const router = useRouter();

    const handleClick = () => {
        if (onClick) {
            onClick(result);
        } else {
            if ((result.type === "person" || result.type === "invite") && result.pubkey) {
                router.push(`/network/${result.pubkey}`);
            } else if (result.type === "community" && result.id) {
                const params = new URLSearchParams();
                if (result.relayUrl) params.set("relay", result.relayUrl);
                const query = params.toString();
                router.push(`/groups/${encodeURIComponent(result.id)}${query ? `?${query}` : ""}`);
            }
        }
    };

    const handleAdd = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onAdd) {
            onAdd(result);
        } else if (result.pubkey) {
            router.push(`/?pubkey=${result.pubkey}`);
        }
    };

    const getIcon = () => {
        switch (result.type) {
            case "community":
                return <Users className="h-5 w-5 text-muted-foreground" />;
            case "person":
                return <User className="h-5 w-5 text-muted-foreground" />;
            case "invite":
                return <PlusCircle className="h-5 w-5 text-muted-foreground" />;
            case "link":
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
            className="group relative flex items-center gap-4 p-4 rounded-3xl bg-card hover:bg-accent/40 border border-border/50 hover:border-primary/20 transition-all cursor-pointer shadow-sm hover:shadow-xl hover:shadow-primary/5 active:scale-[0.99]"
        >
            <div className="relative">
                <Avatar className="h-14 w-14 border border-border shadow-sm group-hover:border-primary/30 transition-colors bg-muted">
                    {result.picture ? (
                        <Image
                            src={result.picture}
                            alt={result.name}
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

                {(result.type === "person" || result.type === "invite") && (
                    <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary border-2 border-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlusCircle className="h-3 w-3 text-primary-foreground" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h4 className="font-black text-base text-foreground truncate group-hover:text-primary transition-colors">
                        {result.name || result.display_name}
                    </h4>
                    {result.nip05 && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 bg-primary/5 px-2 py-0.5 rounded-full">
                            Verified
                        </span>
                    )}
                </div>

                {result.display_name && result.display_name !== result.name && (
                    <p className="text-sm text-muted-foreground/80 truncate font-medium">
                        @{result.display_name}
                    </p>
                )}

                <p className="text-[10px] text-muted-foreground font-mono mt-1 opacity-60 truncate">
                    {result.pubkey || result.id || result.relayUrl}
                </p>

                {result.about && (
                    <p className="text-xs text-muted-foreground/70 mt-2 line-clamp-1 italic">
                        {result.about}
                    </p>
                )}
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                {(result.type === "person" || result.type === "invite") && (
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleAdd}
                        className="h-9 w-9 rounded-xl bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground transition-all"
                    >
                        <UserPlus className="h-4 w-4" />
                    </Button>
                )}
                <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-muted/50 group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary transition-all">
                    <ChevronRight className="h-5 w-5" />
                </div>
            </div>

            {/* Entity Badge */}
            <div className="absolute top-2 right-4">
                <span className={cn(
                    "text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full",
                    result.type === "community" ? "bg-amber-500/10 text-amber-500" : "bg-indigo-500/10 text-indigo-500"
                )}>
                    {result.type}
                </span>
            </div>
        </div>
    );
}
