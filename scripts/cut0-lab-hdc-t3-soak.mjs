#!/usr/bin/env node
/**
 * Cut 0.10 headless L2 — thin H-dc v0.1 + opaque envelope soak (≠ Soft L3).
 * Covers checklist steps 6–8 (health · POST envelope · poll since=).
 *
 * @see specs/backend/cut0-lab-milestone-checklist-2026-11-09.md
 * @see specs/backend/cut0-private-trust-glue-design-2026-11-09.md
 */
import { startPrivateDcLabServer, PRIVATE_DC_LAB_DEFAULTS } from "./lib/private-dc-lab-server.mjs";

const log = (step, ok, detail) => {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${step}${detail ? ` — ${detail}` : ""}`);
};

const main = async () => {
  const lab = await startPrivateDcLabServer({
    port: Number(process.env.CUT0_HDC_PORT ?? PRIVATE_DC_LAB_DEFAULTS.port),
    bearerToken: process.env.CUT0_HDC_TOKEN ?? PRIVATE_DC_LAB_DEFAULTS.bearerToken,
  });
  const headers = {
    Authorization: `Bearer ${lab.bearerToken}`,
    "Content-Type": "application/json",
  };

  let failed = 0;
  try {
    const healthRes = await fetch(`${lab.baseUrl}/v1/health`, { headers });
    const health = await healthRes.json();
    const healthOk = healthRes.ok && health.ok === true && health.wire === "hdc-v0.1";
    log("6 health", healthOk, JSON.stringify(health));
    if (!healthOk) failed += 1;

    const since = Date.now() - 1;
    const envelope = Buffer.from("T3\x01lab-opaque-envelope").toString("base64");
    const postRes = await fetch(`${lab.baseUrl}/v1/conversations/ops/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        envelope,
        clientMessageId: `cmid-${Date.now()}`,
      }),
    });
    const posted = await postRes.json();
    const postOk =
      postRes.ok
      && typeof posted.message?.id === "string"
      && posted.message?.envelope === envelope
      && posted.message?.status === "accepted"
      && posted.message?.status !== "delivered";
    log("7 POST envelope → accepted≠delivered", postOk, `id=${posted.message?.id} status=${posted.message?.status}`);
    if (!postOk) failed += 1;

    const pollRes = await fetch(
      `${lab.baseUrl}/v1/conversations/ops/messages?since=${since}`,
      { headers },
    );
    const polled = await pollRes.json();
    const rows = Array.isArray(polled.messages) ? polled.messages : [];
    const cipherRows = rows.filter((row) => typeof row.envelope === "string" && row.envelope.length > 0);
    const pollOk = pollRes.ok && cipherRows.some((row) => row.id === posted.message?.id);
    log("8 poll ?since= cipher envelopes", pollOk, `cipherRows=${cipherRows.length}`);
    if (!pollOk) failed += 1;

    // Plaintext-only POST still allowed on lab v0 path — ensure poll does not require body.
    const plainRes = await fetch(`${lab.baseUrl}/v1/conversations/ops/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: "plaintext-lab-seed" }),
    });
    const plainOk = plainRes.ok;
    log("lab v0 plaintext path still available (not T3)", plainOk, `status=${plainRes.status}`);
    if (!plainOk) failed += 1;
  } finally {
    await lab.close();
  }

  if (failed > 0) {
    console.error(`cut0-lab-hdc-t3-soak: ${failed} step(s) failed (≠ Soft L3 claim either way)`);
    process.exit(1);
  }
  console.log("cut0-lab-hdc-t3-soak: headless H-dc steps 6–8 Pass (≠ Soft L3 Fixed)");
};

main().catch((error) => {
  console.error(`cut0-lab-hdc-t3-soak failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
