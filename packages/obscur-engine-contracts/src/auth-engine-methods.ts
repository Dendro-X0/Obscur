import type { EngineInvokeRequest } from "./host-engine-port";

export const AUTH_ENGINE_METHODS = {
  getBootSnapshot: "getBootSnapshot",
} as const;

export type AuthEngineMethod = (typeof AUTH_ENGINE_METHODS)[keyof typeof AUTH_ENGINE_METHODS];

export type AuthGetBootSnapshotPayload = Readonly<{
  expectedPubkeyHex?: string;
  restoreEligible?: boolean;
}>;

export const isAuthEngineMethod = (method: string): method is AuthEngineMethod => (
  method === AUTH_ENGINE_METHODS.getBootSnapshot
);

export const buildAuthGetBootSnapshotRequest = (params: Readonly<{
  profileId: string;
  windowLabel?: string;
  payload?: AuthGetBootSnapshotPayload;
}>): EngineInvokeRequest => ({
  engine: "auth",
  method: AUTH_ENGINE_METHODS.getBootSnapshot,
  scope: {
    profileId: params.profileId,
    ...(params.windowLabel ? { windowLabel: params.windowLabel } : {}),
  },
  payload: params.payload ?? {},
});
