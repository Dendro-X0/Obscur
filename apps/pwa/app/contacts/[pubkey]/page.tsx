"use client";

import React from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
    ChevronLeft,
    MessageSquare,
    Ban,
    UserMinus,
    Shield,
    Share2,
    CheckCircle2,
    Plus
} from "lucide-react";
import { useContacts } from "@/app/features/contacts/providers/contacts-provider";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { useMessaging } from "@/app/features/messaging/providers/messaging-provider";
import { useProfileMetadata } from "@/app/features/profile/hooks/use-profile-metadata";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { ConfirmDialog } from "@/app/components/ui/confirm-dialog";
import { toast } from "@/app/components/ui/toast";

export default function ContactProfilePage() {
    const { pubkey } = useParams();
    const router = useRouter();
    const { t } = useTranslation();
    const { peerTrust, requestsInbox, blocklist } = useContacts();
    const { createdContacts } = useMessaging();

    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = React.useState(false);
    const [isBlockDialogOpen, setIsBlockDialogOpen] = React.useState(false);

    const pk = Array.isArray(pubkey) ? pubkey[0]! : pubkey!;
    const metadata = useProfileMetadata(pk);

    if (!pk) return null;

    const isTrusted = peerTrust?.state?.acceptedPeers?.includes(pk as PublicKeyHex) ?? false;
    const isBlocked = blocklist?.state?.blockedPublicKeys?.includes(pk as PublicKeyHex) ?? false;
    const contact = createdContacts.find(c => c.kind === 'dm' && c.pubkey === pk);

    const resolvedName = metadata?.displayName || contact?.displayName || pk.slice(0, 8);
    const displayHandle = resolvedName ? `@${resolvedName}` : `@${pk.slice(0, 8)}...${pk.slice(-8)}`;

    const handleMessage = () => {
        router.push(`/?pubkey=${encodeURIComponent(pk)}`);
    };

    const handleToggleBlock = () => {
        if (isBlocked) {
            blocklist.removeBlocked({ publicKeyHex: pk as PublicKeyHex });
            toast.success(t("contacts.notifications.unblocked", "User unblocked"));
        } else {
            setIsBlockDialogOpen(true);
        }
    };

    const confirmBlock = () => {
        blocklist.addBlocked({ publicKeyInput: pk });
        setIsBlockDialogOpen(false);
        toast.success(t("contacts.notifications.blocked", "User blocked"));
    };

    const handleRemoveContact = () => {
        setIsRemoveDialogOpen(true);
    };

    const confirmRemove = () => {
        peerTrust.unacceptPeer({ publicKeyHex: pk as PublicKeyHex });
        requestsInbox.setStatus({ peerPublicKeyHex: pk as PublicKeyHex, status: 'declined' });
        setIsRemoveDialogOpen(false);
        toast.success(t("contacts.notifications.removed", "Contact removed"));
        router.push("/contacts");
    };

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/5">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.back()}
                    className="rounded-full"
                >
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <h1 className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                    {t("contacts.profileTitle", "Contact Profile")}
                </h1>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Share2 className="h-5 w-5" />
                </Button>
            </div>

            <main className="max-w-2xl mx-auto p-4 flex flex-col gap-6 pt-8">
                {/* Profile Header Card */}
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="relative">
                        <div className="h-32 w-32 rounded-full ring-4 ring-white dark:ring-zinc-900 shadow-2xl overflow-hidden bg-gradient-to-br from-purple-100 to-zinc-100 dark:from-purple-900/20 dark:to-zinc-800 flex items-center justify-center">
                            {metadata?.avatarUrl ? (
                                <Image
                                    src={metadata.avatarUrl}
                                    alt={resolvedName}
                                    width={128}
                                    height={128}
                                    className="h-full w-full object-cover"
                                    unoptimized
                                />
                            ) : (
                                <span className="text-4xl font-black text-purple-700 dark:text-purple-300">
                                    {resolvedName.slice(0, 1).toUpperCase()}
                                </span>
                            )}
                        </div>
                        {isTrusted && (
                            <div className="absolute bottom-1 right-1 bg-emerald-500 text-white p-1.5 rounded-full ring-4 ring-white dark:ring-zinc-950 shadow-lg">
                                <CheckCircle2 className="h-5 w-5" />
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50">
                            {displayHandle}
                        </h2>
                        <div className="flex items-center justify-center gap-2">
                            {isTrusted ? (
                                <span className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                                    <Shield className="h-3.5 w-3.5" />
                                    {t("contacts.status.trusted", "Trusted")}
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 bg-zinc-100 dark:bg-white/5 text-zinc-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                                    {t("contacts.status.stranger", "Not in Contacts")}
                                </span>
                            )}
                            {isBlocked && (
                                <span className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-red-100 dark:border-red-500/20">
                                    <Ban className="h-3.5 w-3.5" />
                                    {t("contacts.status.blocked", "Blocked")}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Main Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        size="lg"
                        onClick={handleMessage}
                        className="h-14 gap-3 bg-purple-600 hover:bg-purple-700 text-white shadow-xl shadow-purple-500/20 rounded-2xl font-bold"
                    >
                        <MessageSquare className="h-5 w-5" />
                        {t("contacts.actions.message", "Message")}
                    </Button>
                    <Button
                        size="lg"
                        variant="secondary"
                        className="h-14 gap-3 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-white/5 rounded-2xl font-bold shadow-sm"
                    >
                        <Plus className="h-5 w-5" />
                        {t("contacts.actions.invite", "Invite to Group")}
                    </Button>
                </div>

                {/* Info Card */}
                <Card className="overflow-hidden border-zinc-200/50 dark:border-white/5 bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl">
                    <div className="p-4 flex flex-col gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">
                                {t("contacts.info.publicKey", "Public Key")}
                            </label>
                            <div className="p-3 rounded-xl bg-zinc-100/50 dark:bg-black/20 border border-zinc-200/50 dark:border-white/5 overflow-hidden">
                                <p className="text-xs font-mono text-zinc-500 break-all leading-relaxed">
                                    {pk}
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Danger Zone */}
                <div className="flex flex-col gap-3 mt-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">
                        {t("contacts.dangerZone", "Danger Zone")}
                    </h3>
                    <Card className="overflow-hidden border-red-100 dark:border-red-900/20 bg-red-50/30 dark:bg-red-900/5">
                        <div className="flex flex-col divide-y divide-red-100 dark:divide-red-900/20">
                            <button
                                onClick={handleToggleBlock}
                                className="flex items-center justify-between p-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-600">
                                        <Ban className="h-5 w-5" />
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                                            {isBlocked ? t("contacts.actions.unblock", "Unblock user") : t("contacts.actions.block", "Block user")}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                            {isBlocked ? t("contacts.desc.unblock", "Allow this user to message you again") : t("contacts.desc.block", "Stop receiving messages from this user")}
                                        </p>
                                    </div>
                                </div>
                            </button>

                            {isTrusted && (
                                <button
                                    onClick={handleRemoveContact}
                                    className="flex items-center justify-between p-4 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20 text-red-600">
                                            <UserMinus className="h-5 w-5" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                                                {t("contacts.actions.remove", "Remove contact")}
                                            </p>
                                            <p className="text-xs text-zinc-500">
                                                {t("contacts.desc.remove", "Remove this user from your trusted contacts list")}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            )}
                        </div>
                    </Card>
                </div>
            </main>

            <ConfirmDialog
                isOpen={isRemoveDialogOpen}
                onClose={() => setIsRemoveDialogOpen(false)}
                onConfirm={confirmRemove}
                title={t("contacts.dialogs.removeTitle", "Remove Contact")}
                description={t("contacts.dialogs.removeDesc", "Are you sure you want to remove this contact from your trusted list?")}
                confirmLabel={t("contacts.actions.remove", "Remove")}
                variant="danger"
            />

            <ConfirmDialog
                isOpen={isBlockDialogOpen}
                onClose={() => setIsBlockDialogOpen(false)}
                onConfirm={confirmBlock}
                title={t("contacts.dialogs.blockTitle", "Block User")}
                description={t("contacts.dialogs.blockDesc", "Are you sure you want to block this user? You will no longer receive their messages.")}
                confirmLabel={t("contacts.actions.block", "Block")}
                variant="danger"
            />
        </div>
    );
}
