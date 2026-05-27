"use client";

import { useEffect, useState } from "react";
import { WORKSPACE_DEV_FLAGS_CHANGED_EVENT } from "../services/community-dev-flags";

/** Re-render create/join gates after Settings → Operator setup writes flags. */
export const useWorkspaceDevFlagsRevision = (): number => {
    const [revision, setRevision] = useState(0);
    useEffect(() => {
        const bump = (): void => setRevision((value) => value + 1);
        window.addEventListener(WORKSPACE_DEV_FLAGS_CHANGED_EVENT, bump);
        window.addEventListener("storage", bump);
        return () => {
            window.removeEventListener(WORKSPACE_DEV_FLAGS_CHANGED_EVENT, bump);
            window.removeEventListener("storage", bump);
        };
    }, []);
    return revision;
};
