"use client";

import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";

export const isTanstackQueryV1Enabled = (): boolean => {
  return PrivacySettingsService.getSettings().tanstackQueryV1 === true;
};

