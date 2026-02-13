"use client";

import type React from "react";
import Image from "next/image";
import type { Contact, ContactGroup } from "@/app/features/invites/utils/types";
import { MessageSquare, MoreVertical, Shield, ShieldCheck, ShieldOff, User } from "lucide-react";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";

interface ContactCardProps {
    contact: Contact;
    groups: ContactGroup[];
    onSelect: (contact: Contact) => void;
}

export const ContactCard = ({ contact, groups, onSelect }: ContactCardProps) => {
    const router = useRouter();

    const contactGroups = groups.filter(g => contact.groups.includes(g.id));

    const getTrustIcon = () => {
        switch (contact.trustLevel) {
            case "trusted": return <ShieldCheck className="h-3 w-3 text-emerald-500" />;
            case "blocked": return <ShieldOff className="h-3 w-3 text-red-500" />;
            default: return <Shield className="h-3 w-3 text-zinc-400" />;
        }
    };

    const handleChat = (e: React.MouseEvent) => {
        e.stopPropagation();
        router.push(`/?pubkey=${encodeURIComponent(contact.publicKey)}`);
    };

    return (
        <div
            onClick={() => onSelect(contact)}
            className="group relative flex items-center gap-4 rounded-2xl border border-black/5 bg-white p-4 transition-all hover:border-black/10 hover:shadow-sm dark:border-white/5 dark:bg-zinc-900/50 dark:hover:border-white/10"
        >
            {/* Avatar Section */}
            <div className="relative shrink-0">
                {contact.avatar ? (
                    <Image
                        src={contact.avatar}
                        alt={contact.displayName}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full object-cover ring-2 ring-white dark:ring-zinc-800"
                        unoptimized
                    />
                ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 ring-2 ring-white dark:bg-zinc-800 dark:ring-zinc-800">
                        <User className="h-6 w-6 text-zinc-400" />
                    </div>
                )}
                <div className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5 shadow-sm dark:bg-zinc-900">
                    {getTrustIcon()}
                </div>
            </div>

            {/* Info Section */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
                        {contact.displayName}
                    </h3>
                    {contact.lastSeen && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                    )}
                </div>

                {contact.bio ? (
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {contact.bio}
                    </p>
                ) : (
                    <p className="truncate font-mono text-[10px] text-zinc-400">
                        {contact.publicKey.slice(0, 16)}...
                    </p>
                )}

                {contactGroups.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                        {contactGroups.map(group => (
                            <span
                                key={group.id}
                                className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                            >
                                {group.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Actions Section */}
            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleChat}
                    className="h-8 w-8 rounded-full p-0"
                >
                    <MessageSquare className="h-4 w-4" />
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 w-8 rounded-full p-0"
                >
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
};
