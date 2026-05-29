import { describe, expect, it } from "vitest";
import worker from "./index";

const env = {
  DB: {} as D1Database,
  ENVIRONMENT: "test",
};

describe("coordination worker CORS", () => {
  it("OPTIONS preflight returns 204 with empty body", async () => {
    const response = await worker.fetch(
      new Request("http://127.0.0.1:8787/communities/v2_test/membership/delta", { method: "OPTIONS" }),
      env,
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
