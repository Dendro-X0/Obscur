import React from "react";
import type { ReactionEmoji } from "../types";

const REACTION_VARIANTS: ReadonlyArray<ReactionEmoji> = [
    "\u{1F44D}",
    "\u{2764}\u{FE0F}",
    "\u{1F602}",
    "\u{1F525}",
    "\u{1F44F}",
];
const VIEWPORT_MARGIN_PX = 8;
const PICKER_GAP_PX = 8;

interface ReactionPickerProps {
    x: number;
    y: number;
    onSelect: (emoji: ReactionEmoji) => void;
    pickerRef: React.RefObject<HTMLDivElement | null>;
}

export function ReactionPicker({ x, y, onSelect, pickerRef }: ReactionPickerProps) {
    const [position, setPosition] = React.useState<Readonly<{ left: number; top: number }>>({
        left: x,
        top: y,
    });

    React.useLayoutEffect(() => {
        if (typeof window === "undefined") {
            return;
        }
        const panel = pickerRef.current;
        if (!panel) {
            setPosition({ left: x, top: y });
            return;
        }
        const rect = panel.getBoundingClientRect();
        const pickerWidth = Math.max(rect.width, 220);
        const pickerHeight = Math.max(rect.height, 56);
        const maxLeft = Math.max(VIEWPORT_MARGIN_PX, window.innerWidth - pickerWidth - VIEWPORT_MARGIN_PX);
        const maxTop = Math.max(VIEWPORT_MARGIN_PX, window.innerHeight - pickerHeight - VIEWPORT_MARGIN_PX);

        let nextLeft = x - pickerWidth / 2;
        let nextTop = y - pickerHeight - PICKER_GAP_PX;

        if (nextTop < VIEWPORT_MARGIN_PX) {
            nextTop = y + PICKER_GAP_PX;
        }

        nextLeft = Math.min(Math.max(nextLeft, VIEWPORT_MARGIN_PX), maxLeft);
        nextTop = Math.min(Math.max(nextTop, VIEWPORT_MARGIN_PX), maxTop);

        setPosition({ left: Math.round(nextLeft), top: Math.round(nextTop) });
    }, [pickerRef, x, y]);

    return (
        <div
            ref={pickerRef}
            className="fixed z-[1200]"
            style={{ left: position.left, top: position.top }}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="flex gap-1 rounded-xl border border-black/10 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-zinc-950">
                {REACTION_VARIANTS.map((emoji) => (
                    <button
                        key={emoji}
                        type="button"
                        className="rounded-lg px-2 py-1 text-2xl transition-transform hover:scale-125 hover:bg-black/5 active:scale-95 dark:hover:bg-white/5"
                        onClick={() => onSelect(emoji)}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </div>
    );
}
