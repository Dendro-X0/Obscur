import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Shield, User } from 'lucide-react';

interface LockScreenProps {
    onUnlock: (passphrase: string) => Promise<boolean>;
    onUnlockPin?: (pin: string) => Promise<boolean>;
    hasPin?: boolean;
    onForget?: () => Promise<void>;
    publicKeyHex?: string;
    isUnlocking?: boolean;
    errorMessage?: string;
    username?: string;
}

export const LockScreen: React.FC<LockScreenProps> = ({
    onUnlock,
    onUnlockPin,
    hasPin = false,
    onForget,
    publicKeyHex,
    isUnlocking = false,
    errorMessage,
    username
}) => {
    const [passphrase, setPassphrase] = useState('');
    const [pin, setPin] = useState('');
    const [error, setError] = useState<string | null>(errorMessage ?? null);
    const [mode, setMode] = useState<'passphrase' | 'pin'>(() => (hasPin ? 'pin' : 'passphrase'));
    const [isVisible, setIsVisible] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (mode === 'pin') {
            if (!onUnlockPin) {
                setError('PIN unlock is not available');
                return;
            }
            if (!pin.trim()) {
                setError('Please enter your password');
                return;
            }
            const success = await onUnlockPin(pin);
            if (!success) {
                setError('Invalid password. Please try again.');
            }
            return;
        }

        if (!passphrase.trim()) {
            setError('Please enter your passphrase');
            return;
        }

        const success = await onUnlock(passphrase);
        if (!success) {
            setError('Invalid passphrase. Please try again.');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-zinc-950/90 backdrop-blur-md px-4 py-safe">
            <div className="w-full max-w-md p-8 rounded-3xl border border-white/5 bg-zinc-900/50 shadow-2xl overflow-hidden relative group my-auto">
                {/* Background glow effect */}
                <div className="absolute -inset-24 top-0 bg-white/5 blur-3xl rounded-full opacity-20 pointer-events-none" />

                <div className="relative flex flex-col items-center text-center space-y-6">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                        <Lock className="w-10 h-10 text-white" strokeWidth={1.5} />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-semibold text-white tracking-tight">Identity Locked</h1>
                        <p className="text-zinc-400 text-sm leading-relaxed max-w-[280px] mx-auto">
                            Your identity is protected. Enter your passphrase to resume messaging.
                        </p>
                    </div>

                    {hasPin && (
                        <div className="flex items-center gap-2 p-1 bg-white/5 border border-white/10 rounded-2xl">
                            <button
                                type="button"
                                onClick={() => {
                                    setMode('pin');
                                    setError(null);
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${mode === 'pin' ? 'bg-white text-black' : 'text-zinc-300 hover:text-white'}`}
                            >
                                Password
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setMode('passphrase');
                                    setError(null);
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${mode === 'passphrase' ? 'bg-white text-black' : 'text-zinc-300 hover:text-white'}`}
                            >
                                Passphrase
                            </button>
                        </div>
                    )}

                    {(username || publicKeyHex) && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-zinc-300 text-[10px] uppercase tracking-wider font-bold">
                            <User className="w-3 h-3" />
                            <span>{username || (publicKeyHex ? `${publicKeyHex.slice(0, 8)}...${publicKeyHex.slice(-8)}` : "")}</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="w-full space-y-4">
                        <div className="space-y-2">
                            <div className="relative">
                                <input
                                    autoFocus
                                    type={isVisible ? "text" : "password"}
                                    placeholder={mode === 'pin' ? 'Enter password...' : 'Enter passphrase...'}
                                    value={mode === 'pin' ? pin : passphrase}
                                    onChange={(e) => mode === 'pin' ? setPin(e.target.value) : setPassphrase(e.target.value)}
                                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-5 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all text-center text-lg tracking-widest"
                                />
                                <button
                                    type="button"
                                    onClick={() => setIsVisible(v => !v)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
                                    aria-label={isVisible ? "Hide password" : "Show password"}
                                >
                                    {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
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
                                    <span>Unlock Identity</span>
                                </>
                            )}
                        </button>
                    </form>

                    {onForget && (
                        <button
                            type="button"
                            onClick={() => {
                                if (window.confirm("Are you sure you want to reset your identity? This will permanently delete your local keys and you will need to start over.")) {
                                    void onForget().then(() => {
                                        window.location.reload();
                                    });
                                }
                            }}
                            className="text-zinc-500 hover:text-red-400 text-xs font-medium transition-colors"
                        >
                            Forgot passphrase? Reset account
                        </button>
                    )}

                    <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-[0.1em]">
                        Secured by Nostr Protocol
                    </p>
                </div>
            </div>
        </div>
    );
};
