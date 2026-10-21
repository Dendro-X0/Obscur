import { afterEach, describe, expect, it, vi } from "vitest";
import { matrixLoginAccessToken } from "./matrix-adapter";
import { clearMatrixSession, readMatrixSession } from "./matrix-session";

describe("matrixLoginAccessToken", () => {
  afterEach(() => {
    clearMatrixSession("test-profile");
    vi.unstubAllGlobals();
  });

  it("whoami then persists session", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      user_id: "@sso:matrix.org",
      device_id: "SSODEV",
    }), { status: 200 }));

    const session = await matrixLoginAccessToken({
      homeserverUrl: "https://matrix.org/",
      accessToken: " element-token ",
      profileId: "test-profile",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(session).toEqual({
      homeserverUrl: "https://matrix.org",
      userId: "@sso:matrix.org",
      accessToken: "element-token",
      deviceId: "SSODEV",
    });
    expect(readMatrixSession("test-profile")).toEqual(session);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://matrix.org/_matrix/client/v3/account/whoami",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("requires homeserver and token", async () => {
    await expect(matrixLoginAccessToken({
      homeserverUrl: "",
      accessToken: "tok",
      profileId: "test-profile",
    })).rejects.toThrow(/homeserver and token required/);
  });
});
