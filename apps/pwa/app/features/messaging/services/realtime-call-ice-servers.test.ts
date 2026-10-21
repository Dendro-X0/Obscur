import { describe, expect, it } from "vitest";
import {
  REALTIME_CALL_DEFAULT_STUN_URLS,
  resolveRealtimeCallIceServers,
} from "./realtime-call-ice-servers";

describe("realtime-call-ice-servers", () => {
  it("defaults to public STUN only (stunOnly honesty)", () => {
    const resolved = resolveRealtimeCallIceServers();
    expect(resolved.stunOnly).toBe(true);
    expect(resolved.hasTurn).toBe(false);
    expect(resolved.stunUrlCount).toBe(REALTIME_CALL_DEFAULT_STUN_URLS.length);
    expect(resolved.turnUrlCount).toBe(0);
    expect(resolved.iceServers).toEqual([
      { urls: REALTIME_CALL_DEFAULT_STUN_URLS[0] },
      { urls: REALTIME_CALL_DEFAULT_STUN_URLS[1] },
    ]);
  });

  it("ignores empty or non-turn URLs in TURN env", () => {
    const resolved = resolveRealtimeCallIceServers({
      turnUrlsEnv: " , stun:should-ignore.example ,  ",
    });
    expect(resolved.stunOnly).toBe(true);
    expect(resolved.turnUrlCount).toBe(0);
  });

  it("appends operator TURN urls with optional credentials", () => {
    const resolved = resolveRealtimeCallIceServers({
      turnUrlsEnv: "turn:turn.example:3478?transport=udp, turns:turn.example:5349",
      turnUsernameEnv: "ops",
      turnCredentialEnv: "secret",
    });
    expect(resolved.stunOnly).toBe(false);
    expect(resolved.hasTurn).toBe(true);
    expect(resolved.turnUrlCount).toBe(2);
    expect(resolved.iceServers.at(-1)).toEqual({
      urls: [
        "turn:turn.example:3478?transport=udp",
        "turns:turn.example:5349",
      ],
      username: "ops",
      credential: "secret",
    });
  });

  it("supports a single TURN url without credentials", () => {
    const resolved = resolveRealtimeCallIceServers({
      turnUrlsEnv: "turn:solo.example:3478",
    });
    expect(resolved.iceServers.at(-1)).toEqual({
      urls: "turn:solo.example:3478",
    });
  });
});
