"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

type IdentityCardProps = Readonly<{
  embedded?: boolean;
}>;

export const IdentityCard = (props: IdentityCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [passphrase, setPassphrase] = useState<string>("");
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const identity = useIdentity();
  const state = identity.state;
  const embedded: boolean = props.embedded ?? false;
  const canSubmit: boolean = useMemo((): boolean => passphrase.trim().length >= 6, [passphrase]);
  const onCreate = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    await identity.createIdentity({ passphrase: passphrase as Passphrase });
  };

  const onUnlock = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    await identity.unlockIdentity({ passphrase: passphrase as Passphrase });
  };

  const onLock = (): void => {
    setPassphrase("");
    identity.lockIdentity();
  };

  const onForget = async (): Promise<void> => {
    const confirmed: boolean = window.confirm(t("identity.forgetConfirm"));
    if (!confirmed) {
      return;
    }
    await identity.forgetIdentity();
    setPassphrase("");
  };

  if (state.status === "loading") {
    if (embedded) {
      return <div className="text-sm text-zinc-700 dark:text-zinc-300">{t("identity.loading")}</div>;
    }
    return <Card title={t("identity.title")} description={t("identity.description")}><div>{t("identity.loading")}</div></Card>;
  }

  if (state.status === "error") {
    if (embedded) {
      return <div className="text-sm wrap-break-word text-red-700 dark:text-red-300">{state.error}</div>;
    }
    return <Card tone="danger" title={t("identity.title")} description={t("identity.description")}><div className="wrap-break-word">{state.error}</div></Card>;
  }

  const content: React.JSX.Element = (
    <>
      <div className="space-y-4">
        <div>
          <Label className="mb-2 block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {t("identity.passphraseLabel")}
          </Label>
          <Input
            value={passphrase}
            onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setPassphrase(e.target.value)}
            type="password"
            placeholder={t("identity.passphrasePlaceholder")}
            autoComplete="current-password"
            className="h-12 rounded-xl bg-black/[0.02] dark:bg-white/[0.02]"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {state.stored ? (
            <>
              <Button type="button" onClick={(): void => void onUnlock()} disabled={!canSubmit} className="flex-1">
                {t("identity.unlock")}
              </Button>
              <Button type="button" variant="secondary" onClick={(): void => void onCreate()} disabled={!canSubmit} className="flex-1">
                {t("identity.createNew")}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" onClick={(): void => void onCreate()} disabled={!canSubmit} className="flex-1">
                {t("identity.create")}
              </Button>
              <Button type="button" variant="secondary" onClick={(): void => void onUnlock()} disabled={!canSubmit} className="flex-1">
                {t("identity.unlock")}
              </Button>
            </>
          )}
        </div>

        <div className="pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            onClick={(): void => setAdvancedOpen((v: boolean): boolean => !v)}
          >
            {advancedOpen ? t("identity.hide") : t("identity.advanced")}
          </Button>
        </div>

        {advancedOpen ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="rounded-2xl border border-black/5 bg-zinc-50 p-4 dark:border-white/5 dark:bg-zinc-900/40">
              <div className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-3">{t("identity.advanced")}</div>
              <div className="flex flex-col gap-2">
                <Button type="button" variant="secondary" onClick={onLock} disabled={state.status !== "unlocked"}>
                  {t("identity.lock")}
                </Button>
                <Button type="button" variant="danger" onClick={(): void => void onForget()}>
                  {t("identity.forget")}
                </Button>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-zinc-500 italic">
                {t("identity.forgetWarning")}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 rounded-2xl bg-black/[0.02] p-4 dark:bg-white/[0.02]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t("identity.status")}</div>
            <div className="mt-1 text-sm font-semibold capitalize tracking-tight text-zinc-700 dark:text-zinc-300">{state.status}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t("identity.stored")}</div>
            <div className="mt-1 text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">{state.stored ? t("identity.yes") : t("identity.no")}</div>
          </div>
        </div>

        {state.publicKeyHex ? (
          <div className="space-y-1.5 pt-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t("identity.publicKeyHex")}</div>
            <div className="rounded-xl border border-black/5 bg-white/50 px-3 py-2.5 font-mono text-[10px] break-all dark:border-white/5 dark:bg-zinc-950/60 text-zinc-600 dark:text-zinc-400 leading-relaxed shadow-inner">
              {state.publicKeyHex}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
  if (embedded) {
    return <>{content}</>;
  }
  return <Card title={t("identity.title")} description={t("identity.description")}>{content}</Card>;
};
