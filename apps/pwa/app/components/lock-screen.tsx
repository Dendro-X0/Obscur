import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Shield, User, Fingerprint } from 'lucide-react';

const LOCKED_IDENTITY_LABEL = "Locked profile";

interface LockScreenProps {
    onUnlock: (passphrase: string) => Promise<boolean>;
    onForget?: () => Promise<void>;
    publicKeyHex?: string;
    isUnlocking?: boolean;
    errorMessage?: string;
    username?: string;
    hasPin?: boolean;
    onUnlockPin?: (pin: string) => Promise<boolean>;
    onUnlockBiometric?: () => Promise<boolean>;
    /** Soft-lock: identity already unlocked; only encrypted local storage needs the device password. */
    storageOnly?: boolean;
}

export const LockScreen: React.FC<LockScreenProps> = ({
    onUnlock,
    onForget,
    publicKeyHex,
    isUnlocking = false,
    errorMessage,
    username,
    hasPin = false,
    onUnlockPin,
    onUnlockBiometric,
    storageOnly = false,
}) => {
    const [passphrase, setPassphrase] = useState('');
    const [pin, setPin] = useState('');
    const [mode, setMode] = useState<'password' | 'pin'>(hasPin && !storageOnly ? 'pin' : 'password');
    const [error, setError] = useState<string | null>(errorMessage ?? null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setError(errorMessage ?? null);
    }, [errorMessage]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (mode === 'password') {
            if (!passphrase.trim()) {
                setError('Please enter your password');
                return;
            }
            const success = await onUnlock(passphrase);
            if (!success) {
                setError(storageOnly
                    ? 'Could not open local storage with that password.'
                    : 'Invalid password. Please try again.');
            }
        } else {
            if (pin.length < 4) {
                setError('Please enter your PIN');
                return;
            }
            if (onUnlockPin) {
                const success = await onUnlockPin(pin);
                if (!success) {
                    setError('Invalid PIN. Please try again.');
                    setPin('');
                }
            }
        }
    };

    const title = storageOnly ? 'Local data locked' : 'Identity Locked';
    const description = storageOnly
        ? 'Your identity is already unlocked. Enter your device password to open encrypted storage on this computer.'
        : 'Your identity is protected. Enter your password to resume messaging.';

    return (
        <div className="relative flex-1 flex items-center justify-center overflow-y-auto bg-zinc-950/90 backdrop-blur-md px-4 py-safe">
            <div className="w-full max-w-md p-8 rounded-3xl border border-white/5 bg-zinc-900/50 shadow-2xl overflow-hidden relative group my-auto">
                <div className="absolute -inset-24 top-0 bg-white/5 blur-3xl rounded-full opacity-20 pointer-events-none" />

                <div className="relative flex flex-col items-center text-center space-y-6">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <Lock className="w-10 h-10 text-white" strokeWidth={1.5} />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold text-white tracking-tight">{title}</h1>
                        <p className="text-zinc-400 text-sm leading-relaxed max-w-[280px] mx-auto">
                            {description}
                        </p>
                        {storageOnly ? (
                            <p className="text-[11px] text-zinc-500 max-w-[300px] mx-auto">
                                This is not a second account sign-in — only local database encryption.
                            </p>
                        ) : null}
                    </div>

                    {(username || publicKeyHex) && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-zinc-300 text-[10px] uppercase tracking-wider font-bold">
                            <User className="w-3 h-3" />
                            <span>{username || LOCKED_IDENTITY_LABEL}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        <div className="space-y-2">
                            {mode === 'password' ? (
                                <div className="relative">
                                    <input
                                        autoFocus
                                        type={isVisible ? "text" : "password"}
                                        placeholder={'Enter password...'}
                                        value={passphrase}
                                        onChange={(e) => setPassphrase(e.target.value)}
                                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-center text-lg tracking-widest"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setIsVisible(v => !v)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
                                        aria-label={isVisible ? "Hide password" : "Show password"}
                                    >
                                        {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            ) : (
                                <div className="relative flex justify-center gap-3">
                                    <input
                                        autoFocus
                                        type="password"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        placeholder="Enter PIN"
                                        value={pin}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                                            setPin(val);
                                        }}
                                        className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-center text-2xl tracking-[0.5em] font-black"
                                    />
                                </div>
                            )}
                            {error && (
                                <p className="text-red-400 text-xs font-medium bg-red-400/10 py-2 rounded-lg border border-red-400/20">
                                    {error}
                                </p>
                            )}
                        </div>

                        <button
                            disabled={isUnlocking}
                            type="submit"
                            className="w-full h-14 bg-white text-black font-semibold rounded-2xl hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
                        >
                            {isUnlocking ? (
                                <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Shield className="w-5 h-5" strokeWidth={2.5} />
                                    <span>{storageOnly ? 'Unlock local data' : 'Unlock Identity'}</span>
                                </>
                            )}
                        </button>

                        {hasPin && !storageOnly ? (
                            <button
                                type="button"
                                onClick={() => setMode(mode === 'password' ? 'pin' : 'password')}
                                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                                {mode === 'password' ? 'Use PIN instead' : 'Use password instead'}
                            </button>
                        ) : null}

                        {onUnlockBiometric && !storageOnly ? (
                            <button
                                type="button"
                                onClick={() => { void onUnlockBiometric(); }}
                                className="w-full flex items-center justify-center gap-2 text-xs text-zinc-500 hover:text-zinc-300 py-2"
                            >
                                <Fingerprint className="w-4 h-4" />
                                Use biometrics
                            </button>
                        ) : null}
                    </form>

                    {!storageOnly && onForget ? (
                        <button
                            type="button"
                            className="text-[10px] text-zinc-600 hover:text-red-400 uppercase tracking-widest font-bold"
                            onClick={() => {
                                if (window.confirm("Are you sure you want to reset your identity? This will permanently delete your local keys and you will need to start over.")) {
                                    void onForget().then(() => {
                                        window.location.reload();
                                    });
                                }
                            }}
                        >
                            Forgot password? Reset account
                        </button>
                    ) : null}

                    <div className="text-[9px] text-zinc-700 uppercase tracking-[0.2em] font-black pt-2">
                        Secured by Nostr Protocol
                    </div>
                </div>
            </div>
        </div>
    );
};
