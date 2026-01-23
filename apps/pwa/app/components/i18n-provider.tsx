"use client";

import type React from "react";
import "../lib/i18n/config";

export function I18nProvider({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
