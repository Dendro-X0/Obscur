"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { useTranslation } from "react-i18next";
import { Users, Globe, ArrowRight } from "lucide-react";

interface JoinGroupInputDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onJoin: (groupId: string, relayUrl: string) => void;
}

export const JoinGroupInputDialog = ({ open, onOpenChange, onJoin }: JoinGroupInputDialogProps) => {
    const { t } = useTranslation();
    const [groupUri, setGroupUri] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleNext = () => {
        setError(null);

        // Support format: groupId@relayUrl
        if (groupUri.includes("@")) {
            const [groupId, ...relayParts] = groupUri.split("@");
            const relayHost = relayParts.join("@").trim();

            if (!groupId.trim()) {
                setError("Group ID is required");
                return;
            }

            if (!relayHost) {
                setError("Relay URL or hostname is required");
                return;
            }

            let relayUrl = relayHost;
            if (!relayUrl.startsWith("ws://") && !relayUrl.startsWith("wss://")) {
                relayUrl = `wss://${relayUrl}`;
            }

            onJoin(groupId.trim(), relayUrl);
            onOpenChange(false);
            setGroupUri("");
        } else {
            setError("Please use the format: groupId@relay.com");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-950 border-zinc-200 dark:border-white/10 rounded-[32px]">
                <DialogHeader>
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                            <Users className="h-6 w-6" />
                        </div>
                    </div>
                    <DialogTitle className="text-center text-xl font-bold">
                        Join Community
                    </DialogTitle>
                    <DialogDescription className="text-center text-zinc-500">
                        Enter the group address to join a private community.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="groupUri" className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">
                            Group Address
                        </Label>
                        <div className="relative">
                            <Input
                                id="groupUri"
                                placeholder="my-group@relay.obscur.app"
                                value={groupUri}
                                onChange={(e) => {
                                    setGroupUri(e.target.value);
                                    setError(null);
                                }}
                                className="h-12 bg-zinc-50 dark:bg-white/[0.02] border-zinc-200 dark:border-white/5 rounded-2xl pl-10"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleNext();
                                }}
                            />
                            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        </div>
                        {error && (
                            <p className="text-[10px] font-bold text-red-500 ml-1 mt-1">
                                {error}
                            </p>
                        )}
                        <p className="text-[10px] text-zinc-400 ml-1">
                            Format: <code className="bg-zinc-100 dark:bg-white/5 px-1 rounded">group-id@relay-host</code>
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        onClick={handleNext}
                        className="w-full h-12 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold shadow-lg shadow-purple-500/20 gap-2"
                    >
                        Check Community
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
