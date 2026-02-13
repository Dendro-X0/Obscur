import React, { useMemo, useState, useEffect } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { useTranslation } from "react-i18next";
import { Camera, Loader2, Search, UserCheck, UserX, Check, MessageSquare, UserPlus } from "lucide-react";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { nip19 } from "nostr-tools";
import { useInviteResolver } from "@/app/features/invites/utils/use-invite-resolver";
import { isValidInviteCode } from "@/app/features/invites/utils/invite-parser";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";

import { SearchResultsList } from "../../search/components/search-results-list";
import { QRScanner } from "../../invites/components/qr-scanner";
import { SendRequestDialog } from "../../contacts/components/send-request-dialog";
import type { ProfileSearchResult } from "../../search/services/profile-search-service";
import type { SendResult } from "../controllers/enhanced-dm-controller";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

type NostrProfileMetadata = Readonly<{
    name?: string;
    display_name?: string;
    picture?: string;
    about?: string;
    nip05?: string;
}>;

type Nip05FallbackProfile = Readonly<{
    name?: string;
    nip05?: string;
}>;

type FoundProfile = NostrProfileMetadata | ProfileSearchResult | Nip05FallbackProfile;

const isProfileSearchResult = (value: FoundProfile): value is ProfileSearchResult => {
    return (value as ProfileSearchResult).pubkey !== undefined;
};

const getFoundProfileName = (value: FoundProfile | null): string => {
    if (!value) {
        return "";
    }
    if (isProfileSearchResult(value)) {
        return value.displayName || value.name || "";
    }
    const record = value as Record<string, unknown>;
    const displayName = typeof record.display_name === "string" ? record.display_name : "";
    const name = typeof record.name === "string" ? record.name : "";
    return displayName || name;
};

interface NewChatDialogProps {
    isOpen: boolean;
    onClose: () => void;
    pubkey: string;
    setPubkey: (val: string) => void;
    displayName: string;
    setDisplayName: (val: string) => void;
    onCreate: (pubkey?: string) => void;
    verifyRecipient: (pubkeyHex: string) => Promise<{ exists: boolean; profile?: NostrProfileMetadata }>;
    searchProfiles: (query: string) => Promise<ProfileSearchResult[]>;
    isAccepted: (pubkeyHex: string) => boolean;
    sendConnectionRequest: (params: { peerPublicKeyHex: PublicKeyHex; introMessage?: string }) => Promise<SendResult>;
}

export function NewChatDialog({
    isOpen,
    onClose,
    pubkey,
    setPubkey,
    displayName,
    setDisplayName,
    onCreate,
    verifyRecipient,
    searchProfiles,
    isAccepted,
    sendConnectionRequest
}: NewChatDialogProps) {
    const { t } = useTranslation();
    const [isSearching, setIsSearching] = useState(false);
    const [verificationStatus, setVerificationStatus] = useState<'idle' | 'found' | 'not_found'>('idle');
    const [foundProfile, setFoundProfile] = useState<FoundProfile | null>(null);
    const [resolvedPubkeyHex, setResolvedPubkeyHex] = useState<PublicKeyHex | null>(null);

    const identity = useIdentity();
    const myPublicKeyHex = (identity.state.publicKeyHex as PublicKeyHex | null) ?? null;
    const inviteResolver = useInviteResolver({ myPublicKeyHex });

    const trimmedPubkey = pubkey.trim();
    const parsed = useMemo(() => parsePublicKeyInput(trimmedPubkey), [trimmedPubkey]);

    useEffect(() => {
        if (!isOpen) return;

        const isLikelyNip05 = trimmedPubkey.includes('@');
        const isInviteCode = isValidInviteCode(trimmedPubkey.toUpperCase());

        // If input is empty or clearly invalid (not a potential NIP-05 AND not a valid invite code), reset state
        if (!trimmedPubkey || (!parsed.ok && !isLikelyNip05 && !isInviteCode)) {
            setVerificationStatus('idle');
            setFoundProfile(null);
            setResolvedPubkeyHex(null);
            return;
        }

        // Handle hex/npub auto-resolution
        if (parsed.ok && resolvedPubkeyHex !== parsed.publicKeyHex) {
            // Optimistically set the resolved hex so the button is enabled immediately
            setResolvedPubkeyHex(parsed.publicKeyHex);

            // Start verification
            setIsSearching(true);
            setVerificationStatus('idle');
            setFoundProfile(null);

            void verifyRecipient(parsed.publicKeyHex)
                .then((result) => {
                    // Only update if we are still looking at the same key
                    if (parsed.ok) {
                        if (!result.exists) {
                            setVerificationStatus("not_found");
                            return;
                        }
                        setVerificationStatus("found");
                        setFoundProfile(result.profile ?? null);
                        const name = result.profile?.display_name || result.profile?.name;
                        if (name) {
                            setDisplayName(name);
                        }
                    }
                })
                .catch((e: unknown) => {
                    console.error("Auto-verify recipient failed:", e);
                })
                .finally(() => {
                    setIsSearching(false);
                });
        }
    }, [isOpen, parsed, resolvedPubkeyHex, setDisplayName, verifyRecipient, trimmedPubkey]);

    const [nip05Error, setNip05Error] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);

    const handleScan = (data: string) => {
        let scannnedPubkey = data.trim();

        try {
            if (scannnedPubkey.startsWith('nostr:')) {
                scannnedPubkey = scannnedPubkey.replace('nostr:', '');
            }

            if (scannnedPubkey.startsWith('npub') || scannnedPubkey.startsWith('nprofile')) {
                const decoded = nip19.decode(scannnedPubkey);
                if (decoded.type === 'npub') {
                    scannnedPubkey = decoded.data as string;
                } else if (decoded.type === 'nprofile') {
                    scannnedPubkey = decoded.data.pubkey;
                }
            }
        } catch (e) {
            console.error("Failed to decode scanned QR:", e);
        }

        setPubkey(scannnedPubkey);
        setIsScannerOpen(false);
    };

    const handleUnifiedSearch = async () => {
        const query = trimmedPubkey;
        if (!query || query.length < 3) return;

        setIsSearching(true);
        setVerificationStatus('idle');
        setFoundProfile(null);
        setResolvedPubkeyHex(null);
        setNip05Error(null);
        setSearchResults([]);

        try {
            // Check for Invite Code
            const code = query.toUpperCase();
            if (isValidInviteCode(code)) {
                const resolved = await inviteResolver.resolveCode(code);
                if (resolved) {
                    setResolvedPubkeyHex(resolved.publicKeyHex);
                    setVerificationStatus('found');
                    setFoundProfile({
                        name: resolved.displayName,
                        display_name: resolved.displayName,
                        picture: resolved.avatar
                    });
                    if (resolved.displayName) {
                        setDisplayName(resolved.displayName);
                    }
                } else {
                    setVerificationStatus('not_found');
                }
                return;
            }

            if (query.includes('@')) {
                const nip05 = await import("@/app/features/profile/utils/nip05-resolver").then(m => m.resolveNip05(query));
                if (nip05.ok) {
                    setResolvedPubkeyHex(nip05.publicKeyHex);
                    const result = await verifyRecipient(nip05.publicKeyHex);
                    if (result.exists) {
                        setVerificationStatus('found');
                        setFoundProfile(result.profile ?? null);
                        const name = result.profile?.display_name || result.profile?.name;
                        if (name) setDisplayName(name);
                    } else {
                        setVerificationStatus('found');
                        setFoundProfile({ name: query.split('@')[0], nip05: query });
                    }
                } else {
                    setVerificationStatus('not_found');
                    setNip05Error(t(`messaging.error.nip05.${nip05.reason}`, "Invalid or missing identifier"));
                }
                return;
            }

            if (parsed.ok) {
                setResolvedPubkeyHex(parsed.publicKeyHex);
                const result = await verifyRecipient(parsed.publicKeyHex);
                if (result.exists) {
                    setVerificationStatus('found');
                    setFoundProfile(result.profile ?? null);
                    const name = result.profile?.display_name || result.profile?.name;
                    if (name) setDisplayName(name);
                } else {
                    setVerificationStatus('not_found');
                }
                return;
            }

            const results = await searchProfiles(query);
            setSearchResults(results);
        } catch (e) {
            console.error("Unified search failed:", e);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectProfile = (profile: ProfileSearchResult) => {
        setPubkey(profile.pubkey);
        setDisplayName(profile.displayName || profile.name || "");
        setSearchResults([]);
        setVerificationStatus('found');
        setFoundProfile(profile);
        setResolvedPubkeyHex(profile.pubkey);

        if (!isAccepted(profile.pubkey)) {
            setIsRequestDialogOpen(true);
        }
    };

    const handleSendRequest = async (introMessage: string) => {
        if (!resolvedPubkeyHex) {
            return;
        }

        const result = await sendConnectionRequest({
            peerPublicKeyHex: resolvedPubkeyHex,
            introMessage
        });

        if (result.success) {
            // Also create the conversation locally so it appears in the sidebar using the resolved hex
            onCreate(resolvedPubkeyHex);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <Card title={t("messaging.newChat")} description={t("messaging.startConvByPubkey")} className="w-full max-w-md shadow-2xl border-white/10">
                <div className="space-y-6">
                    <div className="space-y-3">
                        <Label htmlFor="new-chat-pubkey" className="text-xs font-bold uppercase tracking-wider text-zinc-500">{t("messaging.findRecipient")}</Label>
                        <div className="flex gap-2 relative">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <Input
                                    id="new-chat-pubkey"
                                    value={pubkey}
                                    onChange={(e) => setPubkey(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleUnifiedSearch();
                                        }
                                    }}
                                    placeholder={t("messaging.searchPlaceholder")}
                                    className="pl-9 font-mono text-sm bg-zinc-50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 focus:bg-white dark:focus:bg-zinc-900 transition-all rounded-xl"
                                    autoFocus
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="shrink-0 rounded-xl border-black/10 dark:border-white/10"
                                disabled={isSearching}
                                onClick={() => setIsScannerOpen(!isScannerOpen)}
                                title={t("invites.scanQr")}
                            >
                                <Camera className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                            </Button>
                        </div>

                        {!trimmedPubkey && !searchResults.length && (
                            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-purple-500/5 to-blue-500/5 border border-purple-500/10 space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                        <UserCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{t("messaging.cantFindThem")}</h4>
                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("messaging.shareInviteLinkDesc")}</p>
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="w-full text-xs h-8 bg-white dark:bg-zinc-900 border border-black/5 shadow-sm"
                                    onClick={() => {
                                        onClose();
                                    }}
                                >
                                    {t("messaging.shareMyIdentity")}
                                </Button>
                            </div>
                        )}

                        {isScannerOpen && (
                            <div className="animate-in fade-in zoom-in-95 duration-200 rounded-xl overflow-hidden border border-black/10 shadow-lg">
                                <QRScanner
                                    onScan={handleScan}
                                    onClose={() => setIsScannerOpen(false)}
                                />
                            </div>
                        )}

                        {nip05Error && (
                            <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-3 rounded-xl border border-rose-200 dark:border-rose-900/50">
                                <UserX className="h-4 w-4 shrink-0" />
                                <span>{nip05Error}</span>
                            </div>
                        )}

                        <SearchResultsList
                            results={searchResults}
                            onSelect={handleSelectProfile}
                            isAccepted={isAccepted}
                            showSuggestions={!isSearching && searchResults.length === 0 && trimmedPubkey.length >= 3 && !trimmedPubkey.includes('@') && !trimmedPubkey.startsWith('npub') && !trimmedPubkey.startsWith('nprofile') && !trimmedPubkey.startsWith('nostr:') && verificationStatus === 'idle'}
                        />

                        {verificationStatus === 'found' && (
                            <div className="flex items-center justify-between gap-3 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-6 w-6 rounded-full bg-emerald-200 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                                    </div>
                                    <div>
                                        <div className="font-bold">{t("messaging.verifiedUserFound")}</div>
                                        <div className="opacity-80">
                                            {trimmedPubkey.includes('@') ? (
                                                <span className="font-mono bg-emerald-100 dark:bg-emerald-900/50 px-1 rounded">{trimmedPubkey}</span>
                                            ) : (
                                                getFoundProfileName(foundProfile) || t("common.unknown")
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {verificationStatus === 'not_found' && (
                            <div className="space-y-3">
                                <div className="flex items-start gap-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200 dark:border-amber-900/50">
                                    <UserX className="h-4 w-4 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-bold">{t("messaging.noProfileFound") || "No Profile Data Found"}</p>
                                        <p className="opacity-90 leading-relaxed mt-0.5">
                                            {t("messaging.noProfileFoundDesc") || "This user hasn't published a profile yet, but you can still send them message requests using their public key."}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" variant="secondary" size="sm" className="flex-1 text-xs" onClick={() => {
                                        void handleUnifiedSearch();
                                    }}>
                                        {t("messaging.tryGlobalSearch")}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new-chat-name" className="text-xs font-bold uppercase tracking-wider text-zinc-500">{t("messaging.displayName")}</Label>
                        <Input
                            id="new-chat-name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder={t("messaging.displayNamePlaceholder")}
                            className="bg-zinc-50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 rounded-xl"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button type="button" variant="secondary" className="w-full rounded-xl" onClick={onClose}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            className="w-full rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20"
                            onClick={() => {
                                if (resolvedPubkeyHex && !isAccepted(resolvedPubkeyHex)) {
                                    setIsRequestDialogOpen(true);
                                } else {
                                    onCreate(resolvedPubkeyHex || undefined);
                                }
                            }}
                            disabled={!resolvedPubkeyHex || isSearching}
                        >
                            {isSearching ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {t("common.searching")}
                                </span>
                            ) : resolvedPubkeyHex && !isAccepted(resolvedPubkeyHex) ? (
                                <span className="flex items-center gap-2">
                                    <UserPlus className="h-4 w-4" />
                                    {t("contacts.connect")}
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4" />
                                    {t("common.create")}
                                </span>
                            )}
                        </Button>
                    </div>
                </div>
            </Card >

            <SendRequestDialog
                isOpen={isRequestDialogOpen}
                onClose={() => setIsRequestDialogOpen(false)}
                recipientName={displayName || t("common.unknown")}
                onSend={handleSendRequest}
            />
        </div >
    );
}
