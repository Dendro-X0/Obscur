#!/usr/bin/env node
/**
 * G6-4 P3-9 — probe coordination /health (same check as curl).
 */
const base = (process.env.COORDINATION_URL ?? process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/+$/, "");
const url = `${base}/health`;

const run = async () => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const text = await response.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (!response.ok) {
      console.error(`[coordination:health] FAIL http_${response.status} ${url}`);
      console.error(text);
      process.exit(1);
    }
    if (!json?.ok) {
      console.error(`[coordination:health] FAIL health_not_ok ${url}`);
      console.error(text);
      process.exit(1);
    }
    console.log(`[coordination:health] OK ${url}`);
    console.log(text);
    process.exit(0);
  } catch (error) {
    console.error(`[coordination:health] FAIL unreachable ${url}`);
    console.error(error instanceof Error ? error.message : String(error));
    console.error("Start worker: pnpm dev:coordination");
    process.exit(1);
  }
};

run();
