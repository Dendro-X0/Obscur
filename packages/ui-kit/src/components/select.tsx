"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "../utils/cn";

export type SelectFieldOption = Readonly<{
    value: string;
    label: string;
}>;

export type SelectFieldProps = Readonly<{
    id?: string;
    value: string;
    onValueChange: (value: string) => void;
    options: ReadonlyArray<SelectFieldOption>;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    triggerClassName?: string;
    contentClassName?: string;
    size?: "default" | "compact";
    "aria-label"?: string;
}>;

type MenuPosition = Readonly<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
}>;

const computeMenuPosition = (trigger: HTMLElement): MenuPosition => {
    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 8;
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
    const maxHeight = Math.min(240, preferBelow ? spaceBelow - gap : spaceAbove - gap);

    return {
        top: preferBelow ? rect.bottom + gap : Math.max(viewportPadding, rect.top - gap - maxHeight),
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(maxHeight, 120),
    };
};

/**
 * Themed single-select with a body-portaled menu positioned via getBoundingClientRect.
 * Avoids Radix Select/DropdownMenu stacking issues inside custom modals (Add Connection).
 */
export const SelectField: React.FC<SelectFieldProps> = ({
    id,
    value,
    onValueChange,
    options,
    disabled,
    placeholder = "Select…",
    className,
    triggerClassName,
    contentClassName,
    size = "default",
    "aria-label": ariaLabel,
}) => {
    const selected = options.find((option) => option.value === value);
    const displayLabel = selected?.label ?? placeholder;

    const [open, setOpen] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);
    const [position, setPosition] = React.useState<MenuPosition | null>(null);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const updatePosition = React.useCallback(() => {
        if (!triggerRef.current) {
            return;
        }
        setPosition(computeMenuPosition(triggerRef.current));
    }, []);

    React.useLayoutEffect(() => {
        if (!open) {
            return;
        }
        updatePosition();
        window.addEventListener("resize", updatePosition);
        window.addEventListener("scroll", updatePosition, true);
        return () => {
            window.removeEventListener("resize", updatePosition);
            window.removeEventListener("scroll", updatePosition, true);
        };
    }, [open, updatePosition]);

    React.useEffect(() => {
        if (!open) {
            return;
        }

        const onPointerDown = (event: PointerEvent) => {
            const target = event.target as Node;
            if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
                return;
            }
            setOpen(false);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
        };

        document.addEventListener("pointerdown", onPointerDown, true);
        document.addEventListener("keydown", onKeyDown, true);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, true);
            document.removeEventListener("keydown", onKeyDown, true);
        };
    }, [open]);

    const toggleOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (disabled) {
            return;
        }
        setOpen((previous) => !previous);
    };

    const menu =
        open && mounted && position
            ? createPortal(
                  <div
                      ref={menuRef}
                      data-escape-layer="open"
                      role="listbox"
                      aria-label={ariaLabel ?? displayLabel}
                      style={{
                          position: "fixed",
                          top: position.top,
                          left: position.left,
                          width: position.width,
                          maxHeight: position.maxHeight,
                          zIndex: 3000,
                      }}
                      className={cn(
                          "overflow-y-auto rounded-xl border p-1 shadow-lg",
                          "border-black/10 bg-white text-zinc-900",
                          "dark:border-white/10 dark:bg-[#0f0f11] dark:text-zinc-100",
                          contentClassName,
                      )}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                  >
                      {options.map((option) => (
                          <button
                              key={option.value}
                              type="button"
                              role="option"
                              aria-selected={value === option.value}
                              onClick={() => {
                                  onValueChange(option.value);
                                  setOpen(false);
                              }}
                              className={cn(
                                  "flex w-full cursor-pointer rounded-lg py-2 pl-3 pr-3 text-left text-sm outline-none",
                                  "text-zinc-800 hover:bg-zinc-100 focus:bg-zinc-100",
                                  "dark:text-zinc-100 dark:hover:bg-white/10 dark:focus:bg-white/10",
                                  value === option.value && "bg-primary/10 font-medium text-primary dark:text-primary",
                              )}
                          >
                              {option.label}
                          </button>
                      ))}
                  </div>,
                  document.body,
              )
            : null;

    return (
        <div className={className}>
            <button
                ref={triggerRef}
                type="button"
                id={id}
                disabled={disabled}
                aria-label={ariaLabel ?? displayLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={toggleOpen}
                className={cn(
                    "input-enhanced flex w-full items-center justify-between gap-2 rounded-xl border text-left text-sm",
                    "border-black/10 bg-gradient-card text-zinc-900",
                    "dark:border-white/10 dark:text-zinc-100",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    size === "default" && "min-h-10 px-3 py-2",
                    size === "compact" && "min-h-7 px-2 py-1 text-[10px]",
                    triggerClassName,
                )}
            >
                <span className="truncate">{displayLabel}</span>
                <ChevronDown
                    className={cn("shrink-0 opacity-60", size === "compact" ? "h-3 w-3" : "h-4 w-4")}
                    aria-hidden
                />
            </button>
            {menu}
        </div>
    );
};
