import { identityStoreName } from "@/app/features/auth/utils/identity-store-name";
import { openIdentityDb } from "@/app/features/auth/utils/open-identity-db";
import { getProfileIdentityDbKey } from "./profile-scope";

export const clearProfileLocalData = async (profileId: string): Promise<void> => {
  if (typeof window === "undefined") return;

  const suffix = `::${profileId}`;
  const localKeysToRemove: string[] = [];
  const sessionKeysToRemove: string[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) continue;
    if (key.endsWith(suffix)) {
      localKeysToRemove.push(key);
    }
  }

  for (let index = 0; index < window.sessionStorage.length; index += 1) {
    const key = window.sessionStorage.key(index);
    if (!key) continue;
    if (key.endsWith(suffix)) {
      sessionKeysToRemove.push(key);
    }
  }

  localKeysToRemove.forEach((key) => window.localStorage.removeItem(key));
  sessionKeysToRemove.forEach((key) => window.sessionStorage.removeItem(key));

  try {
    const db = await openIdentityDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(identityStoreName, "readwrite");
      const store = tx.objectStore(identityStoreName);
      const req = store.delete(getProfileIdentityDbKey(profileId));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error("Failed to clear profile identity data"));
    });
  } catch {
    // Best-effort cleanup; keep non-destructive behavior.
  }
};
