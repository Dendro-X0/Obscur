"use client";

import type React from "react";
import { PageShell } from "../components/page-shell";
import { ContactsDashboard } from "@/app/features/contacts/components/contacts-dashboard";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useRouter } from "next/navigation";
import { IdentityCard } from "../components/identity-card";
import { useTranslation } from "react-i18next";

export default function ContactsPage(): React.JSX.Element {
    const { t } = useTranslation();
    const router = useRouter();
    const identity = useIdentity();
    const publicKeyHex: string | null = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
    const navBadges = useNavBadges({ publicKeyHex: (publicKeyHex as PublicKeyHex | null) ?? null });

    if (!publicKeyHex) {
        return (
            <PageShell title={t("nav.contacts")} navBadgeCounts={navBadges.navBadgeCounts}>
                <div className="mx-auto w-full max-w-3xl p-4">
                    <Card title={t("invites.noIdentity")} description={t("invites.noIdentityDesc")} className="w-full">
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" onClick={() => router.push("/settings")}>{t("settings.title")}</Button>
                            <Button type="button" variant="secondary" onClick={() => router.push("/search")}>{t("nav.search")}</Button>
                        </div>
                        <div className="pt-3">
                            <IdentityCard />
                        </div>
                    </Card>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell title={t("nav.contacts")} navBadgeCounts={navBadges.navBadgeCounts}>
            <div className="mx-auto w-full max-w-5xl p-4">
                <ContactsDashboard />
            </div>
        </PageShell>
    );
}
