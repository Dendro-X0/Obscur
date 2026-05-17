#!/usr/bin/env node
import { runRelayNipProbe, summarizeRelayNipProbeResults } from "../apps/pwa/app/features/relays/lib/relay-nip-probe.mjs";

const DEFAULT_RELAYS = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.primal.net",
];

const DEFAULT_NIP96 = [
  "https://nostr.build/api/v2/nip96/upload",
  "https://cdn.nostrcheck.me",
];

const parseListArg = (value, fallback) => {
  if (!value) return fallback;
  return Array.from(new Set(
    value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  ));
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {
    relays: DEFAULT_RELAYS,
    nip96: DEFAULT_NIP96,
    timeoutMs: 4500,
    json: false,
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--relays" && args[i + 1]) {
      parsed.relays = parseListArg(args[i + 1], DEFAULT_RELAYS);
      i += 1;
      continue;
    }
    if (arg === "--nip96" && args[i + 1]) {
      parsed.nip96 = parseListArg(args[i + 1], DEFAULT_NIP96);
      i += 1;
      continue;
    }
    if (arg === "--timeout-ms" && args[i + 1]) {
      const value = Number.parseInt(args[i + 1], 10);
      if (Number.isFinite(value) && value > 100) {
        parsed.timeoutMs = value;
      }
      i += 1;
      continue;
    }
    if (arg === "--json") {
      parsed.json = true;
    }
  }
  return parsed;
};

const main = async () => {
  const args = parseArgs();
  const results = await runRelayNipProbe({
    relayUrls: args.relays,
    nip96Urls: args.nip96,
    timeoutMs: args.timeoutMs,
  });
  const summary = summarizeRelayNipProbeResults(results);

  if (args.json) {
    console.log(JSON.stringify({ summary, results }, null, 2));
  } else {
    console.log("[relay-nip-probe] Summary");
    console.log(`ok=${summary.ok} degraded=${summary.degraded} failed=${summary.failed} unsupported=${summary.unsupported}`);
    console.log("[relay-nip-probe] Results");
    results.forEach((entry) => {
      const latency = typeof entry.latencyMs === "number" ? `${entry.latencyMs}ms` : "-";
      const reason = entry.reasonCode || "ok";
      console.log(`${entry.status.padEnd(10)} ${entry.check.padEnd(20)} ${reason.padEnd(28)} ${latency.padStart(8)} ${entry.target}`);
    });
  }

  if (summary.failed > 0) {
    process.exit(1);
  }
};

main().catch((error) => {
  console.error(`[relay-nip-probe] Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
