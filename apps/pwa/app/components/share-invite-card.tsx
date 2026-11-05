"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Copy, Share2, Check, Sparkles, QrCode } from "lucide-react";
import { useUserInviteCode } from "@/app/features/invites/hooks/use-user-invite-code";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import {
  buildContactCardDeepLink,
  createSignedContactCard,
  encodeContactCard,
} from "@/app/features/search/services/contact-card";
import { encodeFriendCodeV2 } from "@/app/features/search/services/friend-code-v2";
import QRCode from "qrcode";
import { useTranslation } from "react-i18next";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";

export const ShareInviteCard = (): React.JSX.Element => {
  const { t } = useTranslation();
  const identity = useIdentity();
  const { enabledRelayUrls } = useRelay();
  const { publicKeyHex, privateKeyHex } = identity.state;
  const { inviteCode, publishCode, isPublishing } = useUserInviteCode({
    publicKeyHex: publicKeyHex as PublicKeyHex | null,
    privateKeyHex: privateKeyHex as PrivateKeyHex | null,
  });

  const [copiedLink, setCopiedLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(true);
  const [shareLink, setShareLink] = useState("");
  const [friendCodeV2, setFriendCodeV2] = useState("");
  const [shareCardEncoded, setShareCardEncoded] = useState("");

  useEffect(() => {
    const pubkey = publicKeyHex as PublicKeyHex | null;
    if (!pubkey) {
      setShareLink("");
      setFriendCodeV2("");
      setShareCardEncoded("");
      setQrDataUrl(null);
      return;
    }

    let cancelled = false;
    void createSignedContactCard({
      pubkey,
      privateKeyHex: privateKeyHex as PrivateKeyHex | null,
      relays: enabledRelayUrls,
      inviteCode: inviteCode || undefined,
    }).then((card) => {
      if (cancelled) return;
      const encoded = encodeContactCard(card);
      const deepLink = buildContactCardDeepLink(card);
      const nextFriendCode =
        encodeFriendCodeV2({
          pubkey,
          relays: enabledRelayUrls,
        }) ?? "";
      setShareCardEncoded(encoded);
      setShareLink(deepLink);
      setFriendCodeV2(nextFriendCode);
      void QRCode.toDataURL(deepLink, {
        width: 400,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      })
        .then((url) => {
          if (!cancelled) setQrDataUrl(url);
        })
        .catch((err) => console.error("QR Generation failed", err));
    });

    return () => {
      cancelled = true;
    };
  }, [enabledRelayUrls, inviteCode, privateKeyHex, publicKeyHex]);

  const handleCopyOb2 = () => {
    if (!friendCodeV2) return;
    void navigator.clipboard.writeText(friendCodeV2);
  };

  const handleCopyNickname = () => {
    if (!inviteCode) return;
    void navigator.clipboard.writeText(inviteCode);
  };

  const handleCopyLink = () => {
    const payload = shareLink || shareCardEncoded;
    if (!payload) return;
    void navigator.clipboard.writeText(payload);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShare = async () => {
    const payload = shareLink || shareCardEncoded;
    if (!payload) return;
    const shareData = {
      title: t("network.shareTitle"),
      text: t("network.shareText"),
      url: payload.startsWith("http") ? payload : undefined,
    };

    if (navigator.share && shareData.url) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error("Share failed:", err);
      }
    } else {
      handleCopyLink();
    }
  };

  if (!publicKeyHex) return <></>;

  return (
    <Card className="overflow-hidden bg-white/50 backdrop-blur-sm dark:bg-zinc-900/50 dark:border-white/10">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {t("network.linkTitle")}
            </h3>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void publishCode()}
            disabled={isPublishing || !inviteCode}
            className="h-7 py-0 px-2 text-[10px] bg-zinc-100 dark:bg-zinc-800"
          >
            {isPublishing ? t("network.syncing") : t("network.syncProfile")}
          </Button>
        </div>

        <div className="flex flex-col items-center justify-center space-y-4 py-2">
          {showQr && qrDataUrl ? (
            <div className="relative group cursor-pointer" onClick={() => setShowQr(false)}>
              <Image
                src={qrDataUrl}
                alt="Contact QR Code"
                width={160}
                height={160}
                className="h-40 w-40 rounded-xl border-4 border-white shadow-xl dark:border-zinc-800 animate-in zoom-in-95 duration-200"
                unoptimized
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                <span className="text-[10px] font-bold uppercase text-zinc-600 bg-white/90 px-2 py-1 rounded-full shadow-sm">
                  {t("network.hideQr")}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-2 w-full">
              <div className="text-xs font-mono break-all line-clamp-2 bg-zinc-100 dark:bg-zinc-800/50 p-3 rounded-lg border border-black/5 dark:border-white/5 text-zinc-600 dark:text-zinc-400">
                {friendCodeV2 || shareCardEncoded || t("network.ob2Hint")}
              </div>
              <p className="text-[10px] text-zinc-500">{t("network.ob2Hint")}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowQr(true)}
                className="h-6 text-[10px] text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400"
              >
                <QrCode className="mr-1 h-3 w-3" /> {t("network.showQr")}
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-zinc-600 dark:text-zinc-400 max-w-[220px]">
            {t("network.sharePrompt")}
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              onClick={handleCopyLink}
              className="flex-1 h-10 shadow-sm"
              variant={copiedLink ? "secondary" : "primary"}
            >
              {copiedLink ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> {t("network.linkCopied")}
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" /> {t("network.copyLink")}
                </>
              )}
            </Button>
            <Button
              onClick={() => void handleShare()}
              variant="secondary"
              className="px-3 h-10 border-zinc-200 dark:border-zinc-800"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
          <Button
            variant="ghost"
            onClick={handleCopyOb2}
            disabled={!friendCodeV2}
            className="h-8 text-[11px] text-zinc-400 hover:text-zinc-600 underline-offset-4 hover:underline"
          >
            {t("network.copyRaw")}
          </Button>
          {inviteCode ? (
            <Button
              variant="ghost"
              onClick={handleCopyNickname}
              className="h-7 text-[10px] text-zinc-400 hover:text-zinc-600"
              title={t("network.vanityHint")}
            >
              {t("network.copyNickname")}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
};
