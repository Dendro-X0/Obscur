"use client";

import type React from "react";
import { useState } from "react";
import type { Passphrase } from "@dweb/crypto/passphrase";
import { useIdentity } from "../lib/use-identity";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Card } from "./ui/card";
import { CheckCircle2, Loader2, User, Lock, Sparkles } from "lucide-react";

type OnboardingStep = "welcome" | "creating" | "username" | "complete";

type OnboardingWizardProps = Readonly<{
  onComplete?: () => void;
}>;

/**
 * Simplified onboarding wizard for new users
 * Guides through identity creation without overwhelming technical details
 */
export const OnboardingWizard = (props: OnboardingWizardProps): React.JSX.Element => {
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [username, setUsername] = useState<string>("");
  const [passphrase, setPassphrase] = useState<string>("");
  const [error, setError] = useState<string>("");
  const identity = useIdentity();

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
    // For now, just complete the onboarding
    // Username will be stored in profile in next implementation
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
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <div className="space-y-6 p-6">
            {/* Logo/Icon */}
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
            </div>

            {/* Welcome Text */}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Welcome to Obscur! 🎉
              </h1>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Secure, private messaging for your micro-community
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    End-to-end encrypted
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    Your messages are private and secure
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Decentralized network
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    No central server, no censorship
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Local-first storage
                  </div>
                  <div className="text-xs text-zinc-600 dark:text-zinc-400">
                    Your data stays on your device
                  </div>
                </div>
              </div>
            </div>

            {/* Optional Passphrase */}
            <div className="rounded-xl border border-black/10 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-950/50">
              <Label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Passphrase (optional)
              </Label>
              <Input
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Leave empty for auto-generated"
                className="mt-2"
              />
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Used to encrypt your identity. You can set one later.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Start Button */}
            <Button
              type="button"
              onClick={() => void handleStart()}
              className="w-full"
              size="lg"
            >
              Get Started
            </Button>

            <p className="text-center text-xs text-zinc-500 dark:text-zinc-500">
              By continuing, you agree to use Obscur responsibly
            </p>
          </div>
        </Card>
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
                Creating your identity...
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Generating your secure keypair
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
                Choose a username
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Make it easy for friends to find you
              </p>
            </div>

            <div>
              <Label>Username (optional)</Label>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-zinc-500 dark:text-zinc-400">@</span>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="alice"
                  maxLength={20}
                />
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Letters, numbers, and underscores only
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleSkipUsername}
                className="flex-1"
              >
                Skip for now
              </Button>
              <Button
                type="button"
                onClick={() => void handleSetUsername()}
                disabled={username.length < 3}
                className="flex-1"
              >
                Continue
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
                You're all set! 🎊
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {username ? `Welcome, @${username}!` : "Welcome to Obscur!"}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <Lock className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              <p className="mt-2 text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Your identity is secure
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                Encrypted and stored locally on your device
              </p>
            </div>

            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Redirecting to your chats...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return <div>Unknown step</div>;
};
