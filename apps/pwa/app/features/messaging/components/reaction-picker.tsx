
import React from "react";
import type { ReactionEmoji } from "../types";

const REACTION_VARIANTS: ReadonlyArray<ReactionEmoji> = ["👍", "❤️", "😂", "🔥", "👏"];

interface ReactionPickerProps {
    x: number;
    y: number;
    onSelect: (emoji: ReactionEmoji) => void;
    pickerRef: React.RefObject<HTMLDivElement | null>;
}

export function ReactionPicker({ x, y, onSelect, pickerRef }: ReactionPickerProps) {
    return (
        <div
            ref={pickerRef}
            className="fixed z-50"
            style={{ left: x, top: y }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="flex gap-1 rounded-xl border border-black/10 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-zinc-950">
                {REACTION_VARIANTS.map((emoji) => (
                    <button
                        key={emoji}
                        type="button"
                        className="rounded-lg px-2 py-1 text-lg hover:bg-black/5 dark:hover:bg-white/5"
                        onClick={() => onSelect(emoji)}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
}
