import React, { useMemo, useState, useEffect } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { useTranslation } from "react-i18next";
import { Camera, Loader2, Search, UserCheck, UserX } from "lucide-react";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";
import { nip19 } from "nostr-tools";

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
    onCreate: () => void;
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

    const trimmedPubkey = pubkey.trim();
    const parsed = parsePublicKeyInput(trimmedPubkey);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        if (!parsed.ok) {
            return;
        }
        if (resolvedPubkeyHex) {
            return;
        }
        setIsSearching(true);
        setResolvedPubkeyHex(parsed.publicKeyHex);
        void verifyRecipient(parsed.publicKeyHex)
            .then((result) => {
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
            })
            .catch((e: unknown) => {
                console.error("Auto-verify recipient failed:", e);
            })
            .finally(() => {
                setIsSearching(false);
            });
    }, [isOpen, parsed.ok, resolvedPubkeyHex, setDisplayName, verifyRecipient]);

    useEffect(() => {
        setVerificationStatus('idle');
        setFoundProfile(null);
        setResolvedPubkeyHex(null);
    }, [pubkey]);

    const [nip05Error, setNip05Error] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<ProfileSearchResult[]>([]);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);



    // Removed auto-opening of request dialog to prevent "fire-hose" experience
    // User must explicitly click "Connect" or "Create" now.

    const handleScan = (data: string) => {
        let scannnedPubkey = data.trim();

        // Handle nprofile/npub/naddr etc.
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
            // Case 1: NIP-05 Resolution
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
                        // Fallback result if recipient service doesn't have it yet, but NIP-05 is valid
                        setVerificationStatus('found');
                        setFoundProfile({ name: query.split('@')[0], nip05: query });
                    }
                } else {
                    setVerificationStatus('not_found');
                    setNip05Error(t(`messaging.error.nip05.${nip05.reason}`, "Invalid or missing identifier"));
                }
                return;
            }

            // Case 2: Pubkey (npub, nprofile, hex)
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

            // Case 3: Global Metadata Search (by name/text)
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

        // If not accepted, show request dialog instead of immediately creating
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
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
            <Card title={t("messaging.newChat")} description={t("messaging.startConvByPubkey")} className="w-full max-w-md shadow-2xl">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="new-chat-pubkey">{t("messaging.searchLabel", "Recipient (Name, @NIP-05, or Public Key)")}</Label>
                        <div className="flex gap-2">
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
                                placeholder="Name, @identifier, or npub..."
                                className="font-mono flex-1"
                                autoFocus
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={trimmedPubkey.length < 3 || isSearching}
                                onClick={handleUnifiedSearch}
                            >
                                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isSearching}
                                onClick={() => setIsScannerOpen(!isScannerOpen)}
                            >
                                <Camera className="h-4 w-4" />
                            </Button>
                        </div>

                        {isScannerOpen && (
                            <div className="animate-in fade-in zoom-in-95 duration-200">
                                <QRScanner
                                    onScan={handleScan}
                                    onClose={() => setIsScannerOpen(false)}
                                />
                            </div>
                        )}

                        {nip05Error && (
                            <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-200 dark:border-rose-900/50">
                                <UserX className="h-3.5 w-3.5" />
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
                            <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/50">
                                <UserCheck className="h-3.5 w-3.5" />
                                <span>
                                    {trimmedPubkey.includes('@') ? `Verified ${trimmedPubkey}: ` : 'User found: '}
                                    @{((): string => {
                                        const name: string = getFoundProfileName(foundProfile);
                                        if (!name) {
                                            return "Unknown";
                                        }
                                        return name.startsWith("nprofile") ? "Unknown" : name;
                                    })()}
                                </span>
                            </div>
                        )}

                        {verificationStatus === 'not_found' && (
                            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-900/50">
                                <UserX className="h-3.5 w-3.5 mt-0.5" />
                                <div>
                                    <p className="font-semibold">User not found on relays.</p>
                                    <p>They might be new or haven&apos;t published a profile. You can still create the chat, but delivery isn&apos;t guaranteed.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="new-chat-name">{t("messaging.displayName")}</Label>
                        <Input
                            id="new-chat-name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Optional"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            className="flex-1"
                            onClick={() => {
                                if (resolvedPubkeyHex && !isAccepted(resolvedPubkeyHex)) {
                                    setIsRequestDialogOpen(true);
                                } else {
                                    onCreate();
                                }
                            }}
                            disabled={!resolvedPubkeyHex}
                        >
                            {resolvedPubkeyHex && !isAccepted(resolvedPubkeyHex) ? t("contacts.connect", "Connect") : t("common.create")}
                        </Button>
                    </div>
                </div>
            </Card>

            <SendRequestDialog
                isOpen={isRequestDialogOpen}
                onClose={() => setIsRequestDialogOpen(false)}
                recipientName={displayName || t("common.unknown")}
                onSend={handleSendRequest}
            />
        </div>
    );
}
