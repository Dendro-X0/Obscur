"use client";

import { useEffect } from "react";
import { runProfileMigrationV088 } from "@/app/features/profiles/services/profile-migration-service";

export function ProfileMigrationBootstrap(): null {
  useEffect(() => {
    void runProfileMigrationV088();
  }, []);

  return null;
}
