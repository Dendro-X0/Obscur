import type { IdentityRootPort } from "@dweb/auth";
import { authFailed, authOk } from "@dweb/auth";
import {
  AuthKernelProfileScopeError,
  readStoredIdentitySnapshot,
  runAuthKernelCreateIdentity,
  runAuthKernelImportIdentity,
} from "@/app/features/auth/services/auth-kernel-legacy-delegates";

const mapIdentityRootError = (error: unknown): ReturnType<typeof authFailed> => {
  if (error instanceof AuthKernelProfileScopeError) {
    return authFailed({
      reasonCode: "invalid_input",
      message: error.message,
    });
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("storage")) {
    return authFailed({ reasonCode: "storage_unavailable", message });
  }
  return authFailed({ reasonCode: "invalid_input", message });
};

export const createAuthKernelIdentityRootPort = (): IdentityRootPort => ({
  readStoredIdentity: async (params) => {
    try {
      const snapshot = await readStoredIdentitySnapshot(params.profileId);
      return authOk(snapshot);
    } catch (error) {
      return mapIdentityRootError(error);
    }
  },
  createIdentity: async (params) => {
    try {
      const record = await runAuthKernelCreateIdentity(params);
      return authOk(record);
    } catch (error) {
      return mapIdentityRootError(error);
    }
  },
  importIdentity: async (params) => {
    try {
      const record = await runAuthKernelImportIdentity(params);
      return authOk(record);
    } catch (error) {
      return mapIdentityRootError(error);
    }
  },
});
