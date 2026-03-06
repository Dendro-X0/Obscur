import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Shield, User, Fingerprint } from 'lucide-react';

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
    onUnlockBiometric
}) => {
    const [passphrase, setPassphrase] = useState('');
    const [pin, setPin] = useState('');
    const [mode, setMode] = useState<'password' | 'pin'>(hasPin ? 'pin' : 'password');
    const [error, setError] = useState<string | null>(errorMessage ?? null);
    const [isVisible, setIsVisible] = useState(false);

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
                setError('Invalid password. Please try again.');
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

    return (
        <div className="relative flex-1 flex items-center justify-center overflow-y-auto bg-zinc-950/90 backdrop-blur-md px-4 py-safe">
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
                            Your identity is protected. Enter your password to resume messaging.
                        </p>
                    </div>

                    {(username || publicKeyHex) && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5 text-zinc-300 text-[10px] uppercase tracking-wider font-bold">
                            <User className="w-3 h-3" />
                            <span>{username || (publicKeyHex ? `${publicKeyHex.slice(0, 8)}...${publicKeyHex.slice(-8)}` : "")}</span>
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
                                        {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                                    <span>Unlock Identity</span>
                                </>
                            )}
                        </button>

                        {hasPin && (
                            <button
                                type="button"
                                onClick={() => {
                                    setMode(mode === 'pin' ? 'password' : 'pin');
                                    setError(null);
                                }}
                                className="w-full text-zinc-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors py-2"
                            >
                                {mode === 'pin' ? 'Use Full Password' : 'Use PIN instead'}
                            </button>
                        )}

                        {onUnlockBiometric && (
                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        setError(null);
                                        const success = await onUnlockBiometric();
                                        if (!success) {
                                            setError('Biometric authentication failed.');
                                        }
                                    }}
                                    className="w-full h-12 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 hover:bg-cyan-500/10 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <Fingerprint className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                    <span className="text-xs font-bold uppercase tracking-wider">Use Biometrics</span>
                                </button>
                            </div>
                        )}
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
                            Forgot password? Reset account
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
