"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  QrCode,
  ScanLine,
  Link as LinkIcon,
  Inbox,
  Send,
  Settings as SettingsIcon,
  Download,
  Users
} from "lucide-react";
import { PageShell } from "../components/page-shell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { IdentityCard } from "../components/identity-card";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import useNavBadges from "@/app/features/main-shell/hooks/use-nav-badges";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { QRCodeGenerator } from "../components/invites/qr-code-generator";
import { InviteLinkCreator } from "../components/invites/invite-link-creator";
import { ContactRequestInbox } from "../components/invites/contact-request-inbox";
import { QRCodeScanner } from "../components/invites/qr-code-scanner";
import { InviteLinkManager } from "../components/invites/invite-link-manager";
import { OutgoingContactRequests } from "../components/invites/outgoing-contact-requests";
import { ContactImportExport } from "../components/invites/contact-import-export";
import { cn } from "@/app/lib/utils";
import { useTranslation } from "react-i18next";

type MainTabType = "my-card" | "add-friend" | "requests" | "manage";

export default function InvitesPage(): React.JSX.Element {
  const { t } = useTranslation();
  const router = useRouter();
  const identity = useIdentity();
  const publicKeyHex: string | null = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
  const navBadges = useNavBadges({ publicKeyHex: (publicKeyHex as PublicKeyHex | null) ?? null });
  const [activeTab, setActiveTab] = useState<MainTabType>("my-card");
  const coordinationConfigured: boolean = (process.env.NEXT_PUBLIC_COORDINATION_URL ?? "").trim().length > 0;

  if (!publicKeyHex) {
    return (
      <PageShell title={t("invites.title")} navBadgeCounts={navBadges.navBadgeCounts}>
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

  const badgeIn = navBadges.navBadgeCounts["/invites"] ?? 0;

  return (
    <PageShell title={t("invites.title")} navBadgeCounts={navBadges.navBadgeCounts}>
      <div className="mx-auto w-full max-w-5xl p-4">
        {!coordinationConfigured ? (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/25 dark:text-amber-100">
            <div className="font-semibold">{t("invites.serverNotConfigured")}</div>
            <div className="mt-1 text-xs text-amber-800 dark:text-amber-200">
              Set <span className="font-mono">NEXT_PUBLIC_COORDINATION_URL</span> in Vercel to enable cross-device invite redemption. Without it, invite links are local-only.
            </div>
          </div>
        ) : null}
        {/* Main Categories */}
        <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CategoryButton
            active={activeTab === "my-card"}
            onClick={() => setActiveTab("my-card")}
            icon={QrCode}
            label={t("invites.myCard")}
          />
          <CategoryButton
            active={activeTab === "add-friend"}
            onClick={() => setActiveTab("add-friend")}
            icon={ScanLine}
            label={t("invites.addFriend")}
          />
          <CategoryButton
            active={activeTab === "requests"}
            onClick={() => setActiveTab("requests")}
            icon={Inbox}
            label={t("invites.requests")}
            badge={badgeIn}
          />
          <CategoryButton
            active={activeTab === "manage"}
            onClick={() => setActiveTab("manage")}
            icon={SettingsIcon}
            label={t("invites.manage")}
          />
        </div>

        {/* Dynamic Content */}
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {activeTab === "my-card" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{t("invites.generateQr")}</h2>
                <QRCodeGenerator />
              </div>
              <div className="space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{t("invites.createLink")}</h2>
                <InviteLinkCreator />
              </div>
            </div>
          )}

          {activeTab === "add-friend" && (
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">{t("invites.scanQr")}</h2>
                <Button variant="secondary" size="sm" onClick={() => router.push("/search")}>
                  <Users className="mr-2 h-4 w-4" />
                  {t("messaging.startConvByPubkey")}
                </Button>
              </div>
              <QRCodeScanner />
            </div>
          )}

          {activeTab === "requests" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  <Inbox className="h-4 w-4" />
                  {t("invites.requestsInbox")}
                </h2>
                <ContactRequestInbox />
              </div>
              <div className="space-y-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  <Send className="h-4 w-4" />
                  {t("invites.requestsSent")}
                </h2>
                <OutgoingContactRequests />
              </div>
            </div>
          )}

          {activeTab === "manage" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  <LinkIcon className="h-4 w-4" />
                  {t("invites.manageLinks")}
                </h2>
                <InviteLinkManager />
              </div>
              <div className="space-y-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  <Download className="h-4 w-4" />
                  {t("invites.importExport")}
                </h2>
                <ContactImportExport />
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function CategoryButton({
  active,
  onClick,
  icon: Icon,
  label,
  badge
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border p-4 transition-all",
        active
          ? "border-purple-500/50 bg-purple-500/10 text-purple-600 dark:border-purple-400/50 dark:bg-purple-400/10 dark:text-purple-400 shadow-sm"
          : "border-black/5 bg-white text-zinc-500 hover:bg-zinc-50 dark:border-white/5 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:bg-zinc-900/60"
      )}
    >
      <div className="relative">
        <Icon className={cn("h-6 w-6", active ? "animate-in zoom-in-75 duration-300" : "")} />
        {badge ? (
          <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
            {badge}
          </span>
        ) : null}
      </div>
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
