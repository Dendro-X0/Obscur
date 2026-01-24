"use client";

import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { useIdentity } from "../lib/use-identity";
import { useProfile } from "../lib/use-profile";
import { Button } from "./ui/button";
import { ShareInviteCard } from "./share-invite-card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { CheckCircle2, Loader2, User, Lock } from "lucide-react";
import { LanguageSelector } from "./language-selector";

type OnboardingStep = "welcome" | "creating" | "username" | "complete";

type OnboardingWizardProps = Readonly<{
  onComplete?: () => void;
}>;

/**
 * Simplified onboarding wizard for new users
 * Guides through identity creation without overwhelming technical details
 */
export const OnboardingWizard = (props: OnboardingWizardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [username, setUsername] = useState<string>("");
  const [passphrase, setPassphrase] = useState<string>("");
  const [error, setError] = useState<string>("");
  const identity = useIdentity();
  const profile = useProfile();

  const handleStart = async (): Promise<void> => {
    setStep("creating");
    setError("");

    try {
      // Auto-generate a secure passphrase or use a simple default
      const autoPassphrase = passphrase.trim() || "obscur-default-passphrase";

      await identity.createIdentity({ passphrase: autoPassphrase as Passphrase });

      // Move to username step
      setStep("username");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create identity");
      setStep("welcome");
    }
  };

  const handleSetUsername = async (): Promise<void> => {
    // Store username in local profile
    if (username.trim()) {
      profile.setUsername({ username: username.trim() });
    }
    setStep("complete");

    // Call completion callback after a short delay
    setTimeout(() => {
      props.onComplete?.();
    }, 2000);
  };

  const handleSkipUsername = (): void => {
    setStep("complete");
    setTimeout(() => {
      props.onComplete?.();
    }, 2000);
  };

  // Welcome Screen
  if (step === "welcome") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-zinc-50 dark:bg-black relative">
        <div className="absolute top-4 right-4 z-10">
          <LanguageSelector variant="minimal" />
        </div>

        <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
          <div className="space-y-8 py-8 md:py-12">
            {/* Logo/Icon */}
            <div className="flex justify-center">
              <div className="relative flex h-40 w-40 items-center justify-center">
                <img src="/obscur-logo-light.svg" alt="Obscur Logo" className="h-40 w-40 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)] dark:hidden" />
                <img src="/obscur-logo-dark.svg" alt="Obscur Logo" className="hidden h-40 w-40 drop-shadow-[0_0_30px_rgba(168,85,247,0.5)] dark:block" />
              </div>
            </div>

            {/* Welcome Text */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-4xl">
                {t("onboarding.welcome.title")}
              </h1>
              <p className="text-lg font-medium text-zinc-600 dark:text-zinc-400">
                {t("onboarding.welcome.subtitle")}
              </p>
            </div>

            {/* Features List */}
            <div className="grid gap-4 px-4 sm:grid-cols-2">
              <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900/50 dark:ring-1 dark:ring-white/10 sm:flex-col sm:items-start sm:gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                  <Lock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("onboarding.welcome.features.encrypted.title")}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("onboarding.welcome.features.encrypted.desc")}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-zinc-900/50 dark:ring-1 dark:ring-white/10 sm:flex-col sm:items-start sm:gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("onboarding.welcome.features.decentralized.title")}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {t("onboarding.welcome.features.decentralized.desc")}
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Passphrase */}
            <div className="px-4">
              <div className="group relative">
                <div className="absolute inset-0 -inset-x-2 rounded-xl bg-zinc-100 opacity-0 transition group-hover:opacity-100 dark:bg-zinc-800/50"></div>
                <div className="relative">
                  <Label
                    htmlFor="passphrase"
                    className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
                  >
                    {t("onboarding.welcome.passphrase.label")}
                  </Label>
                  <Input
                    id="passphrase"
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={t("onboarding.welcome.passphrase.placeholder")}
                    className="border-zinc-200 bg-white/50 backdrop-blur focus:bg-white dark:border-zinc-800 dark:bg-zinc-900/50 dark:focus:bg-zinc-900"
                  />
                  <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                    {t("onboarding.welcome.passphrase.help")}
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mx-4 rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm font-medium text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Start Button */}
            <div className="px-4 pt-2">
              <Button
                type="button"
                onClick={() => void handleStart()}
                className="h-12 w-full rouned-xl text-base font-semibold shadow-lg shadow-purple-500/20 transition-all hover:scale-[1.02] hover:shadow-purple-500/30"
                size="lg"
              >
                {t("common.getStarted")}
              </Button>

              <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-600">
                {t("onboarding.welcome.disclaimer")}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Creating Identity Screen
  if (step === "creating") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="space-y-6 p-6 text-center">
            <div className="flex justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                {t("onboarding.creating.title")}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t("onboarding.creating.desc")}
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Username Setup Screen
  if (step === "username") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="space-y-6 p-6">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-500">
                <User className="h-8 w-8 text-white" />
              </div>
            </div>

            <div className="text-center">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                {t("onboarding.username.title")}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t("onboarding.username.subtitle")}
              </p>
            </div>

            <div>
              <Label>{t("onboarding.username.label")}</Label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">@</span>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder={t("onboarding.username.placeholder")}
                  maxLength={20}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                {t("onboarding.username.help")}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleSkipUsername}
                className="flex-1"
              >
                {t("common.skip")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSetUsername()}
                disabled={username.length < 3}
                className="flex-1"
              >
                {t("common.continue")}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Complete Screen
  if (step === "complete") {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="space-y-6 p-6 text-center">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-green-500">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
            </div>

            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                {t("onboarding.complete.title")}
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {username
                  ? t("onboarding.complete.welcomeUser", { username })
                  : t("onboarding.complete.welcomeGeneric")}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <Lock className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              <p className="mt-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">
                {t("onboarding.complete.securityTitle")}
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                {t("onboarding.complete.securityDesc")}
              </p>
            </div>

            <ShareInviteCard />

            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {t("onboarding.complete.redirecting")}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return <div>Unknown step</div>;
};
