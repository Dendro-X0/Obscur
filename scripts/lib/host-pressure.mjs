/**
 * One-shot Windows CPU + disk sample. Used to refuse extra dev stacks
 * when the machine is already pegged (freeze / forced reboot class).
 *
 *   node scripts/lib/host-pressure.mjs
 *   OBSCUR_ALLOW_HOST_PRESSURE=1  bypass
 */
import { execFile } from "node:child_process";

const DEFAULT_CPU_MAX = 90;
const DEFAULT_DISK_MAX = 85;

const readLimit = (name, fallback) => {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 && raw <= 100 ? raw : fallback;
};

export const sampleHostPressure = () => new Promise((resolve) => {
  if (process.platform !== "win32") {
    resolve({ skipped: true, reason: "non-windows" });
    return;
  }
  const script = [
    "$cpu = (Get-Counter '\\Processor(_Total)\\% Processor Time' -SampleInterval 1 -MaxSamples 1).CounterSamples[0].CookedValue",
    "$disk = (Get-Counter '\\PhysicalDisk(_Total)\\% Disk Time' -SampleInterval 1 -MaxSamples 1).CounterSamples[0].CookedValue",
    "Write-Output ([string]::Format('{0:N0} {1:N0}', $cpu, $disk))",
  ].join("; ");
  execFile(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
    { timeout: 12_000, windowsHide: true },
    (error, stdout) => {
      if (error) {
        resolve({ skipped: true, reason: error.message || "counter-failed" });
        return;
      }
      const [cpu, disk] = String(stdout).trim().split(/\s+/).map((part) => Number(part));
      if (!Number.isFinite(cpu) || !Number.isFinite(disk)) {
        resolve({ skipped: true, reason: "unparsed" });
        return;
      }
      resolve({ skipped: false, cpu, disk });
    },
  );
});

/**
 * @returns {Promise<{ allowed: boolean, detail: string }>}
 */
export const assertHostHasHeadroom = async (log = console.log) => {
  if (process.env.OBSCUR_ALLOW_HOST_PRESSURE === "1") {
    log("[host-pressure] bypass (OBSCUR_ALLOW_HOST_PRESSURE=1)");
    return { allowed: true, detail: "bypass" };
  }
  const cpuMax = readLimit("OBSCUR_HOST_CPU_MAX", DEFAULT_CPU_MAX);
  const diskMax = readLimit("OBSCUR_HOST_DISK_MAX", DEFAULT_DISK_MAX);
  const sample = await sampleHostPressure();
  if (sample.skipped) {
    log(`[host-pressure] sample skipped (${sample.reason}) — continuing`);
    return { allowed: true, detail: "skipped" };
  }
  const detail = `cpu ${sample.cpu}% (max ${cpuMax}) · disk ${sample.disk}% (max ${diskMax})`;
  if (sample.cpu >= cpuMax || sample.disk >= diskMax) {
    log(`[host-pressure] REFUSE — ${detail}`);
    log("[host-pressure] Stop extra terminals, then: pnpm kill:dev-stack");
    log("[host-pressure] Override only if you accept a freeze: OBSCUR_ALLOW_HOST_PRESSURE=1");
    return { allowed: false, detail };
  }
  log(`[host-pressure] ok — ${detail}`);
  return { allowed: true, detail };
};

const isDirectRun = process.argv[1] && process.argv[1].replaceAll("\\", "/").endsWith("scripts/lib/host-pressure.mjs");
if (isDirectRun) {
  const result = await assertHostHasHeadroom();
  process.exit(result.allowed ? 0 : 2);
}
