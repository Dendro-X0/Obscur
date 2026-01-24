
import React from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Textarea } from "../../../components/ui/textarea";
import { useTranslation } from "react-i18next";

interface NewGroupDialogProps {
    isOpen: boolean;
    onClose: () => void;
    name: string;
    setName: (val: string) => void;
    memberPubkeys: string;
    setMemberPubkeys: (val: string) => void;
    onCreate: () => void;
}

export function NewGroupDialog({ isOpen, onClose, name, setName, memberPubkeys, setMemberPubkeys, onCreate }: NewGroupDialogProps) {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <Card title={t("messaging.newGroup")} description={t("messaging.createGroupDesc")} className="w-full max-w-md">
                <div className="space-y-3">
                    <div className="space-y-2">
                        <Label htmlFor="new-group-name">{t("messaging.groupName")}</Label>
                        <Input
                            id="new-group-name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Optional"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="new-group-members">{t("messaging.memberPubkeys")}</Label>
                        <Textarea
                            id="new-group-members"
                            value={memberPubkeys}
                            onChange={(e) => setMemberPubkeys(e.target.value)}
                            placeholder="npub...\nnpub..."
                            rows={4}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="secondary"
                            className="flex-1"
                            onClick={onClose}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" className="flex-1" onClick={onCreate}>
                            {t("common.create")}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
