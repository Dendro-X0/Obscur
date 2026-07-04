"use client";
import React from "react";
import { useTranslation } from "react-i18next";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { Button, Card, cn } from "@dweb/ui-kit";
import {
  sensitivityHintKey,
  sensitivityLabelKey,
} from "@/app/features/dm-kernel/contact-trust-sensitivity";
import { useDmKernelTrustBanner } from "@/app/features/dm-kernel/use-dm-kernel-trust-banner";
import { useThreadMessages } from "@/app/features/messaging/hooks/use-thread-messages";
import type { DmConversation } from "@/app/features/messaging/types";
import { createDmConversation } from "@/app/features/messaging/utils/create-dm-conversation";
import { useContactTrustSensitivity } from "@/app/features/network/hooks/use-contact-trust-sensitivity";
import { ContactTrustSensitivityControl } from "./contact-trust-sensitivity-control";

export function ContactProfileTrustNotice(props: Readonly<{
    peerPublicKeyHex: PublicKeyHex;
    isPeerAccepted: boolean;
    connection: DmConversation | undefined;
    myPublicKeyHex: string;
    resolvedName: string;
    compact?: boolean;
}>): React.JSX.Element {
    const { t } = useTranslation();
    const { sensitivity, setSensitivity } = useContactTrustSensitivity(props.peerPublicKeyHex);
    const conversation = React.useMemo((): DmConversation | null => {
        if (props.connection) {
            return props.connection;
        }
        return createDmConversation({
            myPublicKeyHex: props.myPublicKeyHex,
            peerPublicKeyHex: props.peerPublicKeyHex,
            displayName: props.resolvedName,
        });
    }, [props.connection, props.myPublicKeyHex, props.peerPublicKeyHex, props.resolvedName]);
    const thread = useThreadMessages(conversation, props.myPublicKeyHex);
    const trust = useDmKernelTrustBanner({
        conversation: conversation ?? {
            id: "",
            kind: "dm",
            pubkey: props.peerPublicKeyHex,
            displayName: props.resolvedName,
            lastMessage: "",
            lastMessageTime: new Date(0),
            unreadCount: 0,
        },
        peerPublicKeyHex: props.peerPublicKeyHex,
        isPeerAccepted: props.isPeerAccepted,
        messages: thread.messages,
        connectionFallback: props.connection,
        contactTrustSensitivity: sensitivity,
    });
    const connectionStatusLabel = props.isPeerAccepted
        ? t("network.trust.levelTrusted")
        : t("network.trust.levelStranger");
    return (
      <Card className={cn("border border-zinc-200/70 bg-white/88 backdrop-blur-xl dark:border-white/10 dark:bg-[#07101f]/88", props.compact ? "rounded-2xl p-4" : "rounded-[32px] p-6 sm:p-8")} data-testid="contact-profile-trust-notice">
        <div className={cn("flex flex-col", props.compact ? "gap-3" : "gap-5")}>
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
              <ShieldAlert className="h-5 w-5 text-amber-700 dark:text-amber-300" aria-hidden/>
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
                {t("network.trust.sectionTitle")}
              </p>
              <p className={cn("font-semibold text-zinc-900 dark:text-white", props.compact ? "text-sm" : "text-lg")}>
                {t(sensitivityLabelKey(sensitivity))}
              </p>
              <p className={cn("leading-relaxed text-zinc-600 dark:text-zinc-400", props.compact ? "text-xs" : "text-sm")}>
                {t(sensitivityHintKey(sensitivity))}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-500">
                {t("network.trust.connectionStatus", { status: connectionStatusLabel })}
              </p>
            </div>
          </div>

          <ContactTrustSensitivityControl
            sensitivity={sensitivity}
            onSensitivityChange={setSensitivity}
            compact={props.compact}
          />

          {trust.showBanner && trust.assessment ? (
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 p-4" data-testid="contact-profile-trust-banner" data-trust-tier={trust.assessment.tier} data-trust-bundle={trust.assessment.bundleId ?? "none"}>
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                {t("messaging.trust.bannerTitle")}
              </p>
              <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
                {t(trust.assessment.copyKey)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" className="rounded-xl border border-amber-500/30 bg-amber-500/15 text-xs font-bold text-amber-950 dark:text-amber-50" onClick={trust.dismiss} data-testid="contact-profile-trust-dismiss">
                  {t("messaging.trust.dismiss")}
                </Button>
                <Button type="button" size="sm" variant="ghost" className="rounded-xl text-xs font-bold text-amber-900/80 dark:text-amber-200/80" onClick={() => trust.setExpanded(!trust.expanded)}>
                  {trust.expanded
                ? t("messaging.trust.hideDetails")
                : t("messaging.trust.showDetails")}
                </Button>
              </div>
              {trust.expanded ? (
                <ul className="mt-3 list-disc pl-5 text-[11px] text-amber-900/75 dark:text-amber-100/75">
                  {trust.assessment.activeSignals.map((signal) => (
                    <li key={signal}>{t(`messaging.trust.signal.${signal}`)}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : trust.assessment?.tier === "none" && props.connection?.lastMessage ? (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-900 dark:text-emerald-100">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0"/>
              <p>
                {t("network.trust.dismissedOrClear")}
              </p>
            </div>
          ) : null}
        </div>
      </Card>
    );
}
