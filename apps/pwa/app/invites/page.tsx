"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "../components/page-shell";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { IdentityCard } from "../components/identity-card";
import { useIdentity } from "../lib/use-identity";
import useNavBadges from "../lib/use-nav-badges";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { QRCodeGenerator } from "../components/invites/qr-code-generator";
import { InviteLinkCreator } from "../components/invites/invite-link-creator";
import { ContactRequestInbox } from "../components/invites/contact-request-inbox";
import { ContactList } from "../components/invites/contact-list";
import { QRCodeScanner } from "../components/invites/qr-code-scanner";
import { InviteLinkManager } from "../components/invites/invite-link-manager";
import { useHorizontalScroll } from "../lib/use-horizontal-scroll";
import { OutgoingContactRequests } from "../components/invites/outgoing-contact-requests";
import { ContactImportExport } from "../components/invites/contact-import-export";
import { ProfileSettings } from "../components/invites/profile-settings";

type TabType =
  | "qr-generator"
  | "qr-scanner"
  | "invite-links"
  | "link-manager"
  | "contact-requests"
  | "outgoing-requests"
  | "contacts"
  | "import-export"
  | "profile";

export default function InvitesPage(): React.JSX.Element {
  const router = useRouter();
  const identity = useIdentity();
  const publicKeyHex: string | null = identity.state.publicKeyHex ?? identity.state.stored?.publicKeyHex ?? null;
  const navBadges = useNavBadges({ publicKeyHex: (publicKeyHex as PublicKeyHex | null) ?? null });
  const [activeTab, setActiveTab] = useState<TabType>("qr-generator");
  const tabRef = useHorizontalScroll<HTMLDivElement>();

  if (!publicKeyHex) {
    return (
      <PageShell title="Invites" navBadgeCounts={navBadges.navBadgeCounts}>
        <div className="mx-auto w-full max-w-3xl p-4">
          <Card title="No identity" description="Create an identity to use the invite system." className="w-full">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => router.push("/settings")}>Settings</Button>
              <Button type="button" variant="secondary" onClick={() => router.push("/search")}>Search</Button>
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
    <PageShell title="Invites" navBadgeCounts={navBadges.navBadgeCounts}>
      <div className="mx-auto w-full max-w-5xl p-4">
        {/* Tab Navigation */}
        <div
          ref={tabRef}
          className="mb-6 overflow-x-auto scrollbar-immersive"
        >
          <div className="flex gap-2 min-w-max">
            <TabButton
              active={activeTab === "qr-generator"}
              onClick={() => setActiveTab("qr-generator")}
            >
              Generate QR
            </TabButton>
            <TabButton
              active={activeTab === "qr-scanner"}
              onClick={() => setActiveTab("qr-scanner")}
            >
              Scan QR
            </TabButton>
            <TabButton
              active={activeTab === "invite-links"}
              onClick={() => setActiveTab("invite-links")}
            >
              Create Link
            </TabButton>
            <TabButton
              active={activeTab === "link-manager"}
              onClick={() => setActiveTab("link-manager")}
            >
              Manage Links
            </TabButton>
            <TabButton
              active={activeTab === "contact-requests"}
              onClick={() => setActiveTab("contact-requests")}
            >
              Requests
            </TabButton>
            <TabButton
              active={activeTab === "outgoing-requests"}
              onClick={() => setActiveTab("outgoing-requests")}
            >
              Sent Requests
            </TabButton>
            <TabButton
              active={activeTab === "contacts"}
              onClick={() => setActiveTab("contacts")}
            >
              Contacts
            </TabButton>
            <TabButton
              active={activeTab === "import-export"}
              onClick={() => setActiveTab("import-export")}
            >
              Import/Export
            </TabButton>
            <TabButton
              active={activeTab === "profile"}
              onClick={() => setActiveTab("profile")}
            >
              Profile
            </TabButton>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-4">
          {activeTab === "qr-generator" && <QRCodeGenerator />}
          {activeTab === "qr-scanner" && <QRCodeScanner />}
          {activeTab === "invite-links" && <InviteLinkCreator />}
          {activeTab === "link-manager" && <InviteLinkManager />}
          {activeTab === "contact-requests" && <ContactRequestInbox />}
          {activeTab === "outgoing-requests" && <OutgoingContactRequests />}
          {activeTab === "contacts" && <ContactList />}
          {activeTab === "import-export" && <ContactImportExport />}
          {activeTab === "profile" && <ProfileSettings />}
        </div>
      </div>
    </PageShell>
  );
}

const TabButton = ({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-xl border transition-colors flex-shrink-0 ${active
      ? "border-black/10 bg-zinc-100 text-zinc-900 dark:border-white/10 dark:bg-zinc-900/40 dark:text-zinc-100"
      : "border-transparent text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900/20"
      }`}
  >
    {children}
  </button>
);
