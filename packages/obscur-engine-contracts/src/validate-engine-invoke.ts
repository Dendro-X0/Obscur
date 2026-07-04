import type { EngineId } from "./engine-ids";
import type { EngineInvokeRequest } from "./host-engine-port";
import { isDmEngineMethod } from "./dm-engine-methods";
import { isWorkspaceEngineMethod } from "./workspace-engine-methods";
import { isAuthEngineMethod } from "./auth-engine-methods";
import { isTransportEngineMethod } from "./transport-engine-methods";

const ENGINE_IDS: ReadonlyArray<EngineId> = ["auth", "dm", "workspace", "transport", "persistence"];

export const isEngineId = (value: string): value is EngineId => (
  ENGINE_IDS.includes(value as EngineId)
);

export type EngineInvokeValidationError = Readonly<{
  code: "invalid_engine" | "invalid_scope" | "invalid_method" | "invalid_payload";
  message: string;
}>;

export const validateEngineInvokeRequest = (
  request: EngineInvokeRequest,
): EngineInvokeValidationError | null => {
  if (!isEngineId(request.engine)) {
    return { code: "invalid_engine", message: `Unknown engine: ${request.engine}` };
  }
  if (!request.scope.profileId.trim()) {
    return { code: "invalid_scope", message: "scope.profileId is required" };
  }
  if (request.engine === "dm" && !isDmEngineMethod(request.method)) {
    return { code: "invalid_method", message: `Unknown dm method: ${request.method}` };
  }
  if (request.engine === "dm" && request.method === "getThread") {
    const payload = request.payload as { conversationId?: string } | undefined;
    if (!payload?.conversationId?.trim()) {
      return { code: "invalid_payload", message: "getThread requires payload.conversationId" };
    }
  }
  if (request.engine === "workspace" && !isWorkspaceEngineMethod(request.method)) {
    return { code: "invalid_method", message: `Unknown workspace method: ${request.method}` };
  }
  if (request.engine === "auth" && !isAuthEngineMethod(request.method)) {
    return { code: "invalid_method", message: `Unknown auth method: ${request.method}` };
  }
  if (request.engine === "transport" && !isTransportEngineMethod(request.method)) {
    return { code: "invalid_method", message: `Unknown transport method: ${request.method}` };
  }
  if (request.engine === "transport" && request.method === "publishRelayEvent") {
    const payload = request.payload as { relayUrls?: ReadonlyArray<string>; payload?: string } | undefined;
    const relayUrls = payload?.relayUrls?.map((url) => url.trim()).filter((url) => url.length > 0) ?? [];
    if (relayUrls.length === 0) {
      return { code: "invalid_payload", message: "publishRelayEvent requires payload.relayUrls" };
    }
    if (!payload?.payload?.trim()) {
      return { code: "invalid_payload", message: "publishRelayEvent requires payload.payload" };
    }
  }
  return null;
};
