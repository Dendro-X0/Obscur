"use client";

import React, { createContext, useContext, type ReactNode } from "react";

type CollapsibleContextValue = Readonly<{
    open: boolean;
    onOpenChange: () => void;
}>;

const CollapsibleContext = createContext<CollapsibleContextValue>({
    open: false,
    onOpenChange: () => {},
});

type CollapsibleProps = Readonly<{
    children: ReactNode;
    open?: boolean;
    onOpenChange?: () => void;
    className?: string;
}>;

export const Collapsible = ({ children, open = false, onOpenChange, className }: CollapsibleProps) => (
    <CollapsibleContext.Provider value={{ open, onOpenChange: onOpenChange ?? (() => {}) }}>
        <div className={className}>{children}</div>
    </CollapsibleContext.Provider>
);

type CollapsibleTriggerProps = Readonly<{
    children: ReactNode;
    asChild?: boolean;
    className?: string;
}>;

export const CollapsibleTrigger = ({ children, className }: CollapsibleTriggerProps) => {
    const { onOpenChange } = useContext(CollapsibleContext);
    return (
        <button type="button" className={className} onClick={onOpenChange}>
            {children}
        </button>
    );
};

type CollapsibleContentProps = Readonly<{
    children: ReactNode;
    className?: string;
}>;

export const CollapsibleContent = ({ children, className }: CollapsibleContentProps) => {
    const { open } = useContext(CollapsibleContext);
    if (!open) return null;
    return <div className={className}>{children}</div>;
};
