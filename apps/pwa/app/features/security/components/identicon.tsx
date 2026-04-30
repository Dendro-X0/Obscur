"use client";

import React, { useState, useEffect } from "react";
import { generateIdenticonDataUrl } from "../services/identicon-service";
import { cn } from "../../../lib/cn";
import { Shield, ShieldCheck, ShieldAlert } from "lucide-react";

export interface IdenticonProps {
  publicKeyHex: string;
  size?: number;
  className?: string;
  showKeyFragment?: boolean;
  verified?: boolean;
  onClick?: () => void;
}

export const Identicon: React.FC<IdenticonProps> = ({
  publicKeyHex,
  size = 64,
  className,
  showKeyFragment = false,
  verified = false,
  onClick,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [keyFragment, setKeyFragment] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function generate() {
      try {
        setIsLoading(true);
        const url = await generateIdenticonDataUrl(publicKeyHex, { size });
        const fragment = `${publicKeyHex.slice(0, 8)}...${publicKeyHex.slice(-8)}`;
        
        if (!cancelled) {
          setDataUrl(url);
          setKeyFragment(fragment);
        }
      } catch (error) {
        console.error("Failed to generate identicon:", error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    generate();

    return () => {
      cancelled = true;
    };
  }, [publicKeyHex, size]);

  return (
    <div 
      className={cn(
        "flex flex-col items-center gap-2",
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        className
      )}
      onClick={onClick}
    >
      <div className="relative">
        {isLoading ? (
          <div 
            className="bg-zinc-200 dark:bg-zinc-800 rounded-lg animate-pulse"
            style={{ width: size, height: size }}
          />
        ) : dataUrl ? (
          <img
            src={dataUrl}
            alt={`Identity fingerprint for ${keyFragment}`}
            width={size}
            height={size}
            className="rounded-lg shadow-sm"
            style={{ imageRendering: "pixelated" }}
          />
        ) : null}
        
        {/* Verification badge overlay */}
        {verified !== undefined && (
          <div className={cn(
            "absolute -bottom-1 -right-1 rounded-full p-1 border-2 border-white dark:border-zinc-900",
            verified ? "bg-emerald-500" : "bg-amber-500"
          )}>
            {verified ? (
              <ShieldCheck className="w-3 h-3 text-white" />
            ) : (
              <ShieldAlert className="w-3 h-3 text-white" />
            )}
          </div>
        )}
      </div>
      
      {showKeyFragment && keyFragment && (
        <code className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
          {keyFragment}
        </code>
      )}
    </div>
  );
};

export interface IdentityVerificationCardProps {
  publicKeyHex: string;
  displayName?: string;
  onVerify?: () => void;
  isVerified?: boolean;
  className?: string;
}

export const IdentityVerificationCard: React.FC<IdentityVerificationCardProps> = ({
  publicKeyHex,
  displayName,
  onVerify,
  isVerified = false,
  className,
}) => {
  return (
    <div className={cn(
      "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm",
      className
    )}>
      <div className="flex items-start gap-4">
        <Identicon 
          publicKeyHex={publicKeyHex} 
          size={80}
          verified={isVerified}
        />
        
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {displayName || "Unknown Contact"}
          </h3>
          
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Identity verification helps ensure you are communicating with the right person.
          </p>
          
          <div className="flex items-center gap-2 mt-3">
            <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-600 dark:text-zinc-400 font-mono">
              {publicKeyHex.slice(0, 16)}...{publicKeyHex.slice(-8)}
            </code>
            
            {isVerified ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-3 h-3" />
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <ShieldAlert className="w-3 h-3" />
                Unverified
              </span>
            )}
          </div>
        </div>
      </div>
      
      {!isVerified && onVerify && (
        <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onVerify}
            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Verify Identity
          </button>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 text-center">
            Ask this person to confirm their visual fingerprint matches yours
          </p>
        </div>
      )}
    </div>
  );
};
