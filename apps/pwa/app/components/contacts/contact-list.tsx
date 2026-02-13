"use client";

import React, { useState, useEffect } from "react";
import { contactStore } from "@/app/features/invites/utils/contact-store";
import type { Contact, ContactGroup, TrustLevel } from "@/app/features/invites/utils/types";
import { ContactCard } from "./contact-card";
import { ContactFilters } from "./contact-filters";
import { Users } from "lucide-react";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";

export const ContactList = () => {
    const { t } = useTranslation();
    const router = useRouter();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [groups, setGroups] = useState<ContactGroup[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState("");
    const [trustLevel, setTrustLevel] = useState<TrustLevel | "all">("all");
    const [groupId, setGroupId] = useState<string | "all">("all");

    const loadData = React.useCallback(async () => {
        setLoading(true);
        try {
            const [allContacts, allGroups] = await Promise.all([
                contactStore.getAllContacts(),
                contactStore.getAllGroups()
            ]);

            let filtered = allContacts;

            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                filtered = filtered.filter(c =>
                    c.displayName.toLowerCase().includes(query) ||
                    c.bio?.toLowerCase().includes(query) ||
                    c.publicKey.toLowerCase().includes(query)
                );
            }

            if (trustLevel !== "all") {
                filtered = filtered.filter(c => c.trustLevel === trustLevel);
            }

            if (groupId !== "all") {
                filtered = filtered.filter(c => c.groups.includes(groupId));
            }

            setContacts(filtered);
            setGroups(allGroups);
        } catch (error) {
            console.error("Failed to load contacts:", error);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, trustLevel, groupId]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    if (loading && contacts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-800 dark:border-zinc-800 dark:border-t-zinc-200" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <ContactFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                trustLevel={trustLevel}
                onTrustLevelChange={setTrustLevel}
                groupId={groupId}
                onGroupChange={setGroupId}
                groups={groups}
            />

            {contacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-200 py-12 text-center dark:border-zinc-800">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 dark:bg-zinc-900">
                        <Users className="h-6 w-6 text-zinc-400" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{t("invites.noContactsFound")}</h3>
                    <p className="mt-1 text-xs text-zinc-500">{t("invites.noContactsDesc")}</p>
                    <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.push("/search")}>
                        {t("invites.findPeople")}
                    </Button>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {contacts.map(contact => (
                        <ContactCard
                            key={contact.id}
                            contact={contact}
                            groups={groups}
                            onSelect={(c) => {
                                console.log("Selected contact:", c);
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};
