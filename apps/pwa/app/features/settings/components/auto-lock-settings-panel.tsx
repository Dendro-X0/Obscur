import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Shield, Lock, BellOff } from 'lucide-react';
import { useAutoLock } from '../../../lib/use-auto-lock';
import { Label } from '../../../components/ui/label';
import { Button } from '../../../components/ui/button';

export const AutoLockSettingsPanel: React.FC = () => {
    const { t } = useTranslation();
    const { settings, updateSettings } = useAutoLock();

    const timeoutOptions = [
        { label: '1 minute', value: 1 },
        { label: '5 minutes', value: 5 },
        { label: '15 minutes', value: 15 },
        { label: '30 minutes', value: 30 },
        { label: '1 hour', value: 60 },
        { label: 'Never', value: 0 },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-4 mb-2">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <Shield className="w-6 h-6 text-white" strokeWidth={1.5} />
                </div>
                <div>
                    <h3 className="text-xl font-semibold text-white tracking-tight">Privacy & Safety</h3>
                    <p className="text-zinc-500 text-sm">Manage your session security and auto-lock preferences.</p>
                </div>
            </div>

            <div className="p-6 rounded-3xl bg-zinc-900/50 border border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <Label className="text-base text-white font-medium">Auto-Lock Identity</Label>
                        <p className="text-zinc-500 text-xs max-w-[280px]">Automatically lock your identity when you are inactive to protect your messages.</p>
                    </div>
                    <button
                        onClick={() => updateSettings({ enabled: !settings.enabled })}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-300 focus:outline-none ${settings.enabled ? 'bg-white' : 'bg-zinc-800'
                            }`}
                    >
                        <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-black transition-transform duration-300 ${settings.enabled ? 'translate-x-6' : 'translate-x-1'
                                }`}
                        />
                    </button>
                </div>

                {settings.enabled && (
                    <div className="pt-6 border-t border-white/5 space-y-4 animate-in fade-in duration-500">
                        <div className="flex items-center gap-2 text-zinc-400 text-sm font-medium mb-1">
                            <Clock className="w-4 h-4" />
                            <span>Lock after inactivity</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {timeoutOptions.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => updateSettings({ timeoutMinutes: option.value })}
                                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${settings.timeoutMinutes === option.value
                                            ? 'bg-white text-black shadow-lg shadow-white/5'
                                            : 'bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:border-white/10'
                                        }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 rounded-3xl bg-red-400/5 border border-red-400/10 space-y-4">
                <div className="flex items-center gap-3">
                    <BellOff className="w-5 h-5 text-red-400" />
                    <h4 className="text-sm font-semibold text-red-400 uppercase tracking-wider">Advanced Security</h4>
                </div>
                <p className="text-zinc-500 text-sm leading-relaxed">
                    Enabling auto-lock ensures that your private keys are cleared from memory after the timeout period. You will need to re-enter your passphrase to resume messaging.
                </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-zinc-600">
                <Lock className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]">End-to-End Encrypted Identity</span>
            </div>
        </div>
    );
};
