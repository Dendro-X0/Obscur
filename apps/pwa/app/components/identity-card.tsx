"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { useIdentity } from "../lib/use-identity";
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
      <div>
        <Label className="mb-2 block">{t("identity.passphraseLabel")}</Label>
        <Input
          value={passphrase}
          onChange={(e: React.ChangeEvent<HTMLInputElement>): void => setPassphrase(e.target.value)}
          type="password"
          placeholder={t("identity.passphrasePlaceholder")}
          autoComplete="current-password"
        />
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        {state.stored ? (
          <>
            <Button type="button" onClick={(): void => void onUnlock()} disabled={!canSubmit}>
              {t("identity.unlock")}
            </Button>
            <Button type="button" variant="secondary" onClick={(): void => void onCreate()} disabled={!canSubmit}>
              {t("identity.createNew")}
            </Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={(): void => void onCreate()} disabled={!canSubmit}>
              {t("identity.create")}
            </Button>
            <Button type="button" variant="secondary" onClick={(): void => void onUnlock()} disabled={!canSubmit}>
              {t("identity.unlock")}
            </Button>
          </>
        )}
        <Button
          type="button"
          variant="secondary"
          className="sm:ml-auto"
          onClick={(): void => setAdvancedOpen((v: boolean): boolean => !v)}
        >
          {advancedOpen ? t("identity.hide") : t("identity.advanced")}
        </Button>
      </div>
      {advancedOpen ? (
        <div className="mt-3 rounded-xl border border-black/10 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-950/50">
          <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{t("identity.advanced")}</div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <Button type="button" variant="secondary" onClick={onLock} disabled={state.status !== "unlocked"}>
              {t("identity.lock")}
            </Button>
            <Button type="button" variant="danger" onClick={(): void => void onForget()}>
              {t("identity.forget")}
            </Button>
          </div>
          <div className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            {t("identity.forgetWarning")}
          </div>
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("identity.status")}</div>
          <div className="mt-1 font-semibold tracking-tight">{state.status}</div>
        </div>
        <div>
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("identity.stored")}</div>
          <div className="mt-1 font-semibold tracking-tight">{state.stored ? t("identity.yes") : t("identity.no")}</div>
        </div>
      </div>
      {state.publicKeyHex ? (
        <div className="mt-4">
          <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{t("identity.publicKeyHex")}</div>
          <div className="mt-2 rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-xs wrap-break-word dark:border-white/10 dark:bg-zinc-950/60">
            {state.publicKeyHex}
          </div>
        </div>
      ) : null}
    </>
  );
  if (embedded) {
    return <>{content}</>;
  }
  return <Card title={t("identity.title")} description={t("identity.description")}>{content}</Card>;
};
