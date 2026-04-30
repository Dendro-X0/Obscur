"use client";

import React, { useState } from "react";
import { useIdentity } from "../../auth/hooks/use-identity";
import { Identicon, IdentityVerificationCard } from "../../security/components/identicon";
import { Shield, ShieldCheck, ShieldAlert, ClipboardCopy, Check } from "lucide-react";

/**
 * Security Settings Panel
 * 
 * Integrates v1.4.6 security features:
 * - Identity identicon display
 * - Key verification UI
 */
export const SecuritySettingsPanel: React.FC = () => {
  const identity = useIdentity();
  const [copied, setCopied] = useState(false);

  const publicKeyHex = identity?.state?.publicKeyHex ?? "";

  const copyPublicKey = () => {
    if (publicKeyHex) {
      navigator.clipboard.writeText(publicKeyHex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
          <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Security & Verification
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage your identity verification and security preferences
          </p>
        </div>
      </div>

      {/* Identity Section */}
      <div className="space-y-6">
          {/* Your Identity Card */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">
              Your Identity
            </h3>

            <div className="flex items-start gap-6">
              <Identicon
                publicKeyHex={publicKeyHex || "0".repeat(64)}
                size={96}
                showKeyFragment={false}
              />

              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    Public Key
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 rounded text-zinc-700 dark:text-zinc-300 font-mono flex-1 truncate">
                      {publicKeyHex || "Loading..."}
                    </code>
                    <button
                      onClick={copyPublicKey}
                      className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded transition-colors"
                      title="Copy public key"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ClipboardCopy className="w-4 h-4 text-zinc-500" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Identity verified (local key)
                  </span>
                </div>

                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  This visual fingerprint is uniquely generated from your public key.
                  Share it with contacts to help them verify your identity.
                </p>
              </div>
            </div>
          </div>

          {/* Demo: Contact Verification Card */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">
              Contact Verification Preview
            </h3>
            <IdentityVerificationCard
              publicKeyHex="a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
              displayName="Demo Contact"
              isVerified={false}
              onVerify={() => alert("In production, this would mark the contact as verified")}
            />
          </div>

          {/* Security Tips */}
          <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-amber-900 dark:text-amber-400">
                  Security Tip
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-400/80 mt-1">
                  Always verify your contacts&apos; visual fingerprints before sharing sensitive information.
                  Ask them to confirm their fingerprint matches what you see in their profile.
                </p>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
};
