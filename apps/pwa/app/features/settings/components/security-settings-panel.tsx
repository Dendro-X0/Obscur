"use client";

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useIdentity } from "../../auth/hooks/use-identity";
import { Identicon } from "../../security/components/identicon";
import { toast } from "@dweb/ui-kit/toast";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ClipboardCopy,
  Check,
} from "lucide-react";

/** Fixed demo hex for the contact-side fingerprint preview (not a real peer). */
const DEMO_CONTACT_PUBKEY =
  "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456";

/**
 * Security Settings Panel — one composition for identity fingerprints
 * (you + contact demo), tip, and educational verify action.
 */
export const SecuritySettingsPanel: React.FC = () => {
  const { t } = useTranslation();
  const identity = useIdentity();
  const [copied, setCopied] = useState(false);
  const [demoVerified, setDemoVerified] = useState(false);

  const publicKeyHex = identity?.state?.publicKeyHex ?? "";

  const copyPublicKey = () => {
    if (!publicKeyHex) return;
    void navigator.clipboard.writeText(publicKeyHex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDemoVerify = () => {
    setDemoVerified(true);
    toast.success(t("settings.security.demoVerifyToast"));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-500/20">
          <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {t("settings.security.verificationTitle")}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("settings.security.verificationDesc")}
          </p>
        </div>
      </div>

      <section
        className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
        aria-labelledby="security-fingerprints-heading"
      >
        <div className="mb-5">
          <h3
            id="security-fingerprints-heading"
            className="text-sm font-semibold text-zinc-900 dark:text-white"
          >
            {t("settings.security.fingerprintsTitle")}
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {t("settings.security.fingerprintsLead")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 md:gap-8">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
            <Identicon
              publicKeyHex={publicKeyHex || "0".repeat(64)}
              size={88}
              showKeyFragment={false}
              verified={Boolean(publicKeyHex)}
            />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {t("settings.security.yourIdentity")}
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                  {t("settings.security.publicKey")}
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-zinc-100 px-2 py-1.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {publicKeyHex || t("settings.security.loading")}
                  </code>
                  <button
                    type="button"
                    onClick={copyPublicKey}
                    disabled={!publicKeyHex}
                    className="rounded p-1.5 transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
                    title={t("settings.security.copyPublicKey")}
                    aria-label={t("settings.security.copyPublicKey")}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <ClipboardCopy className="h-4 w-4 text-zinc-500" />
                    )}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                <span className="text-zinc-600 dark:text-zinc-400">
                  {t("settings.security.identityVerifiedLocal")}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {t("settings.security.fingerprintHelp")}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-4 border-t border-zinc-200 pt-6 sm:flex-row sm:items-start md:border-l md:border-t-0 md:pl-8 md:pt-0 dark:border-zinc-800">
            <Identicon
              publicKeyHex={DEMO_CONTACT_PUBKEY}
              size={88}
              showKeyFragment={false}
              verified={demoVerified}
            />
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {t("settings.security.contactVerificationPreview")}
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                  {t("settings.security.demoContact")}
                </p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {t("settings.security.contactVerifyHelp")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {DEMO_CONTACT_PUBKEY.slice(0, 16)}…{DEMO_CONTACT_PUBKEY.slice(-8)}
                </code>
                {demoVerified ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="h-3 w-3" />
                    {t("settings.security.verifiedLabel")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <ShieldAlert className="h-3 w-3" />
                    {t("settings.security.unverifiedLabel")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {!demoVerified ? (
          <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <button
              type="button"
              onClick={handleDemoVerify}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-indigo-700"
            >
              <Shield className="h-4 w-4" />
              {t("settings.security.verifyIdentity")}
            </button>
            <p className="mt-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
              {t("settings.security.verifyIdentityHint")}
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-500/20 dark:bg-amber-500/10">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-400">
              {t("settings.security.securityTipTitle")}
            </p>
            <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-400/80">
              {t("settings.security.securityTipBody")}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
