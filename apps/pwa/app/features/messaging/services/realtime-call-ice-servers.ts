/**
 * R4 — ICE server list + STUN-only honesty.
 * Optional operator TURN via env; no cloud TURN landlord default.
 */

export const REALTIME_CALL_DEFAULT_STUN_URLS = [
  "stun:stun.l.google.com:19302",
  "stun:global.stun.twilio.com:3478",
] as const;

export type RealtimeCallIceServersResolution = Readonly<{
  iceServers: ReadonlyArray<RTCIceServer>;
  stunOnly: boolean;
  hasTurn: boolean;
  stunUrlCount: number;
  turnUrlCount: number;
}>;

const splitCsvUrls = (raw: string | undefined): string[] => {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return [];
  }
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
};

const isTurnUrl = (url: string): boolean => {
  const normalized = url.toLowerCase();
  return normalized.startsWith("turn:") || normalized.startsWith("turns:");
};

const isStunUrl = (url: string): boolean => url.toLowerCase().startsWith("stun:");

export const resolveRealtimeCallIceServers = (params?: Readonly<{
  turnUrlsEnv?: string;
  turnUsernameEnv?: string;
  turnCredentialEnv?: string;
  defaultStunUrls?: ReadonlyArray<string>;
}>): RealtimeCallIceServersResolution => {
  const stunUrls = (params?.defaultStunUrls ?? REALTIME_CALL_DEFAULT_STUN_URLS)
    .map((url) => url.trim())
    .filter((url) => url.length > 0 && isStunUrl(url));

  const turnUrls = splitCsvUrls(params?.turnUrlsEnv).filter(isTurnUrl);
  const username = typeof params?.turnUsernameEnv === "string"
    ? params.turnUsernameEnv.trim()
    : "";
  const credential = typeof params?.turnCredentialEnv === "string"
    ? params.turnCredentialEnv.trim()
    : "";

  const iceServers: RTCIceServer[] = stunUrls.map((urls) => ({ urls }));

  if (turnUrls.length > 0) {
    const turnServer: RTCIceServer = { urls: turnUrls.length === 1 ? turnUrls[0]! : [...turnUrls] };
    if (username.length > 0) {
      turnServer.username = username;
    }
    if (credential.length > 0) {
      turnServer.credential = credential;
    }
    iceServers.push(turnServer);
  }

  const turnUrlCount = turnUrls.length;
  const stunUrlCount = stunUrls.length;
  const hasTurn = turnUrlCount > 0;

  return {
    iceServers,
    stunOnly: !hasTurn,
    hasTurn,
    stunUrlCount,
    turnUrlCount,
  };
};

/** Browser/runtime default: read Next public env once. */
export const resolveRealtimeCallIceServersFromEnv = (): RealtimeCallIceServersResolution => (
  resolveRealtimeCallIceServers({
    turnUrlsEnv: process.env.NEXT_PUBLIC_OBSCUR_ICE_TURN_URLS,
    turnUsernameEnv: process.env.NEXT_PUBLIC_OBSCUR_ICE_TURN_USERNAME,
    turnCredentialEnv: process.env.NEXT_PUBLIC_OBSCUR_ICE_TURN_CREDENTIAL,
  })
);
