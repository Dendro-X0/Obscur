#!/usr/bin/env node
/**
 * P4c — Private DC L2 lab soak (local /v1 wire).
 * Spec: specs/backend/platform-p4c-private-dc-l2-lab-soak-2026-11.md
 *
 *   node scripts/platform-p4c-private-dc-l2-soak.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startPrivateDcLabServer } from "./lib/private-dc-lab-server.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outJson = path.join(repoRoot, "docs", "handoffs", "platform-p4c-private-dc-l2-soak-latest.json");
const outMd = path.join(repoRoot, "docs", "handoffs", "platform-p4c-private-dc-l2-soak-latest.md");

const writeReport = (report) => {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const matrixLines = Object.entries(report.matrix ?? {})
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  const nonClaims = (report.nonClaims ?? []).map((c) => `- ${c}`).join("\n");
  fs.writeFileSync(
    outMd,
    [
      "# Platform P4c private_dc L2 lab soak",
      "",
      `- Captured: ${report.capturedAt}`,
      `- Verdict: **${report.verdict}**`,
      report.reason ? `- Reason: ${report.reason}` : "",
      `- Base URL: \`${report.baseUrl}\``,
      "",
      "## Matrix",
      "",
      matrixLines,
      "",
      "## Non-claims",
      "",
      nonClaims,
      "",
    ].filter(Boolean).join("\n"),
    "utf8",
  );
};

async function main() {
  const lab = await startPrivateDcLabServer({ requireBearer: true });
  const headers = {
    Authorization: `Bearer ${lab.bearerToken}`,
    "Content-Type": "application/json",
  };
  const matrix = {
    listConversations: false,
    listMessages: false,
    sendMessage: false,
    unauthorizedDenied: false,
  };
  let reason;

  try {
    const listRes = await fetch(`${lab.baseUrl}/v1/conversations`, { headers });
    const listBody = await listRes.json();
    matrix.listConversations = listRes.ok
      && Array.isArray(listBody.conversations)
      && listBody.conversations.some((row) => row.id === "ops" && row.title === "Ops");

    const msgsRes = await fetch(`${lab.baseUrl}/v1/conversations/ops/messages`, { headers });
    const msgsBody = await msgsRes.json();
    matrix.listMessages = msgsRes.ok
      && Array.isArray(msgsBody.messages)
      && msgsBody.messages.some((row) => row.body === "lab seed");

    const sendRes = await fetch(`${lab.baseUrl}/v1/conversations/ops/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ body: "p4c-soak-ping" }),
    });
    const sendBody = await sendRes.json();
    matrix.sendMessage = sendRes.ok
      && sendBody.message?.body === "p4c-soak-ping"
      && sendBody.message?.conversationId === "ops"
      && sendBody.message?.direction === "out";

    const badRes = await fetch(`${lab.baseUrl}/v1/conversations`, {
      headers: { Authorization: "Bearer wrong" },
    });
    matrix.unauthorizedDenied = badRes.status === 401;

    if (!Object.values(matrix).every(Boolean)) {
      reason = "matrix_incomplete";
    }
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error);
  } finally {
    await lab.close();
  }

  const verdict = reason ? "Fail" : "Pass";
  const report = {
    capturedAt: new Date().toISOString(),
    surface: "private-dc-lab-http",
    band: "platform-P4c-private-dc-L2-lab",
    baseUrl: lab.baseUrl,
    matrix,
    verdict,
    reason,
    nonClaims: [
      "production company-DC interoperability",
      "Soft L3 Fixed",
      "Tor Verified",
      "Matrix promote",
      "multi-protocol Verified",
    ],
  };
  writeReport(report);
  console.log(JSON.stringify({ verdict, matrix, outJson, outMd }, null, 2));
  process.exit(verdict === "Pass" ? 0 : 2);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
