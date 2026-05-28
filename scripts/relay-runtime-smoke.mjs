#!/usr/bin/env node
import { runRelayNipProbe } from "../apps/pwa/app/features/relays/lib/relay-nip-probe.mjs";

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1 || !args[index + 1]) return fallback;
  return args[index + 1];
};
const hasFlag = (name) => args.includes(name);

const relayUrl = getArg("--relay", "ws://127.0.0.1:7000");
const timeoutMsRaw = Number.parseInt(getArg("--timeout-ms", "6000"), 10);
const timeoutMs = Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 500 ? timeoutMsRaw : 6000;
const requireNip11 = !hasFlag("--skip-nip11");

const main = async () => {
  const results = await runRelayNipProbe({
    relayUrls: [relayUrl],
    nip96Urls: [],
    timeoutMs,
  });

  const relayChecks = new Map(results.map((entry) => [entry.check, entry]));
  const requiredChecks = [
    "relay_socket",
    "relay_publish",
    "relay_subscribe",
    ...(requireNip11 ? ["nip11_fetch"] : []),
  ];
  const failures = [];

  for (const check of requiredChecks) {
    const result = relayChecks.get(check);
    if (!result) {
      failures.push(`${check}:missing`);
      continue;
    }
    if (check === "relay_publish") {
      const publishLooksHealthy = (
        result.status === "ok"
        || (result.status === "degraded" && result.reasonCode === "publish_rejected")
      );
      if (!publishLooksHealthy) {
        failures.push(`${check}:${result.status}:${result.reasonCode ?? "unknown"}`);
      }
      continue;
    }
    if (result.status !== "ok") {
      failures.push(`${check}:${result.status}:${result.reasonCode ?? "unknown"}`);
    }
  }

  console.log("[relay-runtime-smoke] relay", relayUrl);
  if (!requireNip11) {
    console.log("[relay-runtime-smoke] nip11 check is optional for this run.");
  }
  for (const check of requiredChecks) {
    const result = relayChecks.get(check);
    if (!result) {
      console.log(`- ${check}: missing`);
      continue;
    }
    const latency = typeof result.latencyMs === "number" ? `${result.latencyMs}ms` : "-";
    console.log(`- ${check}: ${result.status} (${result.reasonCode ?? "ok"}) ${latency}`);
  }

  if (failures.length > 0) {
    console.error("[relay-runtime-smoke] failed checks:", failures.join(", "));
    process.exit(1);
  }
  console.log("[relay-runtime-smoke] all required relay checks passed.");
};

main().catch((error) => {
  console.error(`[relay-runtime-smoke] fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

