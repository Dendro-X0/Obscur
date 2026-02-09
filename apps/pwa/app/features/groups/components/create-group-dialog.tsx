"use client";

import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { useTranslation } from "react-i18next";
import { Users, Info, Camera, X, Check } from "lucide-react";
import { useUploadService } from "@/app/features/messaging/lib/upload-service";

export interface GroupCreateInfo {
    host: string;
    groupId: string;
    name: string;
    about: string;
    picture?: string;
}

interface CreateGroupDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (info: GroupCreateInfo) => void;
    isCreating?: boolean;
}

export function CreateGroupDialog({ isOpen, onClose, onCreate, isCreating }: CreateGroupDialogProps) {
    const { t } = useTranslation();
    const { uploadFile, pickFiles } = useUploadService();
    const [isUploading, setIsUploading] = useState(false);

    const [info, setInfo] = useState<GroupCreateInfo>({
        host: "relay.obscur.chat", // Default host suggestion
        groupId: "",
        name: "",
        about: "",
        picture: "",
    });

    const isValid =
        info.host.trim().length > 0 &&
        info.groupId.trim().length > 0 &&
        info.name.trim().length > 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <Card
                title={t("groups.createTitle", "Create New Group")}
                description={t("groups.createDescription", "Start a new relay-based group chat.")}
                className="w-full max-w-md shadow-2xl border-white/10"
            >
                <div className="space-y-6">
                    <div className="flex gap-4 items-start">
                        <div className="flex-1 space-y-4">
                            {/* Host Section */}
                            <div className="space-y-2">
                                <Label htmlFor="group-host" className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                    {t("groups.hostLabel", "Relay Host")}
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="group-host"
                                        value={info.host}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInfo(prev => ({ ...prev, host: e.target.value }))}
                                        placeholder="e.g. relay.obscur.chat"
                                        className="bg-zinc-50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 rounded-xl transition-all"
                                    />
                                    <Info className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                                </div>
                            </div>

                            {/* ID Section */}
                            <div className="space-y-2">
                                <Label htmlFor="group-id" className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                                    {t("groups.idLabel", "Group ID")}
                                </Label>
                                <Input
                                    id="group-id"
                                    value={info.groupId}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInfo(prev => ({ ...prev, groupId: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') }))}
                                    placeholder="Unique alphanumeric identifier"
                                    className="bg-zinc-50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 rounded-xl font-mono text-sm"
                                />
                                <p className="text-[10px] text-zinc-400 px-1 italic">
                                    {t("groups.idHint", "Final identifier: ")} {info.host}&apos;{info.groupId || "..."}
                                </p>
                            </div>
                        </div>

                        {/* Avatar Section */}
                        <div className="flex flex-col items-center gap-2 pt-6">
                            <button
                                type="button"
                                disabled={isUploading || isCreating}
                                onClick={async () => {
                                    setIsUploading(true);
                                    try {
                                        const files = await pickFiles();
                                        const file = files?.[0];
                                        if (file) {
                                            const result = await uploadFile(file);
                                            setInfo(prev => ({ ...prev, picture: result.url }));
                                        }
                                    } catch (error) {
                                        console.error("Failed to upload avatar:", error);
                                    } finally {
                                        setIsUploading(false);
                                    }
                                }}
                                className="group relative h-24 w-24 rounded-[32px] bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-purple-500 dark:hover:border-purple-500 transition-colors overflow-hidden"
                            >
                                {info.picture ? (
                                    <img src={info.picture} alt="Group avatar" className="h-full w-full object-cover" />
                                ) : (
                                    <Camera className="h-8 w-8 text-zinc-400 group-hover:text-purple-500 transition-colors" />
                                )}
                                {isUploading && (
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    </div>
                                )}
                            </button>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Avatar</span>
                        </div>
                    </div>

                    {/* Name Section */}
                    <div className="space-y-2">
                        <Label htmlFor="group-name" className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            {t("groups.nameLabel", "Group Name")}
                        </Label>
                        <Input
                            id="group-name"
                            value={info.name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInfo(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Public display name"
                            className="bg-zinc-50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 rounded-xl"
                        />
                    </div>

                    {/* About Section */}
                    <div className="space-y-2">
                        <Label htmlFor="group-about" className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                            {t("groups.aboutLabel", "Description")}
                        </Label>
                        <Textarea
                            id="group-about"
                            value={info.about}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInfo(prev => ({ ...prev, about: e.target.value }))}
                            placeholder="What is this group about?"
                            className="bg-zinc-50 dark:bg-zinc-900/50 border-black/5 dark:border-white/5 rounded-xl min-h-[80px]"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            className="w-full rounded-xl"
                            onClick={onClose}
                            disabled={isCreating || isUploading}
                        >
                            <X className="h-4 w-4 mr-2" />
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="button"
                            className="w-full rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/20"
                            onClick={() => onCreate(info)}
                            disabled={!isValid || isCreating || isUploading}
                        >
                            {isCreating ? (
                                <span className="flex items-center gap-2">
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    {t("common.creating", "Creating...")}
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Check className="h-4 w-4" />
                                    {t("common.create", "Create Group")}
                                </span>
                            )}
                        </Button>
                    </div>
                </div >
            </Card >
        </div >
    );
}

