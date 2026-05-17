"use client";

import type React from "react";
import { PageShell } from "../components/page-shell";
import { NetworkDashboard } from "@/app/features/network/components/network-dashboard";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { Card } from "@dweb/ui-kit";
import { Button } from "@dweb/ui-kit";
import { useRouter } from "next/navigation";
import { IdentityCard } from "../components/identity-card";
import { useTranslation } from "react-i18next";

export default function NetworkPage(): React.JSX.Element {
    const { t } = useTranslation();
    const router = useRouter();
    const identity = useIdentity();
    const publicKeyHex: string | null = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
    const navBadges = useNavBadges({ publicKeyHex: (publicKeyHex as PublicKeyHex | null) ?? null });

    if (!publicKeyHex) {
        return (
            <PageShell title={t("nav.network")} navBadgeCounts={navBadges.navBadgeCounts}>
                <div className="mx-auto w-full max-w-3xl p-4">
                    <Card title={t("network.noIdentity")} description={t("network.noIdentityDesc")} className="w-full">
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
        <PageShell title={t("nav.network")} navBadgeCounts={navBadges.navBadgeCounts}>
            <NetworkDashboard />
        </PageShell>
    );
}
