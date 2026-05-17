#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

const args = process.argv.slice(2);

const getArg = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
};

const hasFlag = (name) => args.includes(name);

const resolveCommand = (cmd) => {
  if (process.platform === "win32" && cmd === "git") {
    return "git.exe";
  }
  return cmd;
};

const quoteShellArg = (value) => {
  if (/^[A-Za-z0-9_./:-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
};

const run = (cmd, commandArgs) => {
  const command = resolveCommand(cmd);
  const result = process.platform === "win32"
    ? spawnSync([command, ...commandArgs].map(quoteShellArg).join(" "), {
      cwd: rootDir,
      encoding: "utf8",
      shell: true,
    })
    : spawnSync(command, commandArgs, {
      cwd: rootDir,
      encoding: "utf8",
    });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
    throw new Error(output || `${cmd} ${commandArgs.join(" ")} failed`);
  }
  return result.stdout.trim();
};

const getDefaultTag = () => {
  const pkg = JSON.parse(readFileSync(resolve(rootDir, "package.json"), "utf8"));
  return `v${pkg.version}`;
};

const deriveOwnerRepoFromOrigin = () => {
  const origin = run("git", ["remote", "get-url", "origin"]);
  const cleaned = origin.replace(/\.git$/, "");
  const httpsMatch = cleaned.match(/github\.com[:/](.+?)\/(.+)$/i);
  if (!httpsMatch) {
    throw new Error(`Unable to parse origin for GitHub owner/repo: ${origin}`);
  }
  return { owner: httpsMatch[1], repo: httpsMatch[2] };
};

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: { "Accept": "application/vnd.github+json" },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${text}`);
  }
  return response.json();
};

const formatState = (status, conclusion) => `${status}/${conclusion ?? ""}`;

const main = async () => {
  const tag = getArg("--tag") ?? getDefaultTag();
  const workflow = getArg("--workflow") ?? "release.yml";
  const perPage = Number.parseInt(getArg("--per-page") ?? "50", 10);
  const ownerArg = getArg("--owner");
  const repoArg = getArg("--repo");
  const showJobs = !hasFlag("--no-jobs");

  const ownerRepo = ownerArg && repoArg
    ? { owner: ownerArg, repo: repoArg }
    : deriveOwnerRepoFromOrigin();

  const runsUrl = new URL(
    `https://api.github.com/repos/${ownerRepo.owner}/${ownerRepo.repo}/actions/workflows/${workflow}/runs`
  );
  runsUrl.searchParams.set("event", "push");
  runsUrl.searchParams.set("per_page", String(Number.isFinite(perPage) ? perPage : 50));

  const runPayload = await fetchJson(runsUrl.toString());
  const runs = Array.isArray(runPayload?.workflow_runs) ? runPayload.workflow_runs : [];
  const targetRuns = runs
    .filter((run) => run?.head_branch === tag)
    .sort((a, b) => {
      const left = Date.parse(a?.created_at ?? "") || 0;
      const right = Date.parse(b?.created_at ?? "") || 0;
      return right - left;
    });

  if (targetRuns.length < 1) {
    throw new Error(
      `No workflow runs found for tag ${tag} in ${ownerRepo.owner}/${ownerRepo.repo} (${workflow}).`
    );
  }

  const latest = targetRuns[0];
  const runId = latest.id;
  console.log(`[release:workflow-status] repo=${ownerRepo.owner}/${ownerRepo.repo}`);
  console.log(`[release:workflow-status] workflow=${workflow}`);
  console.log(`[release:workflow-status] tag=${tag}`);
  console.log(`[release:workflow-status] run_number=${latest.run_number}`);
  console.log(`[release:workflow-status] state=${formatState(latest.status, latest.conclusion)}`);
  console.log(`[release:workflow-status] head_sha=${latest.head_sha}`);
  console.log(`[release:workflow-status] created_at=${latest.created_at}`);
  console.log(`[release:workflow-status] updated_at=${latest.updated_at}`);
  console.log(`[release:workflow-status] url=${latest.html_url}`);

  if (!showJobs) {
    return;
  }

  const jobsUrl = `https://api.github.com/repos/${ownerRepo.owner}/${ownerRepo.repo}/actions/runs/${runId}/jobs?per_page=100`;
  const jobsPayload = await fetchJson(jobsUrl);
  const jobs = Array.isArray(jobsPayload?.jobs) ? jobsPayload.jobs : [];
  console.log(`[release:workflow-status] jobs=${jobs.length}`);

  for (const job of jobs) {
    const line = [
      String(job?.name ?? "unknown"),
      formatState(job?.status ?? "unknown", job?.conclusion ?? ""),
      `${job?.started_at ?? "?"} -> ${job?.completed_at ?? ""}`,
    ].join(" | ");
    console.log(`- ${line}`);
  }

  const publishJob = jobs.find((job) => String(job?.name ?? "").toLowerCase() === "publish release");
  if (!publishJob) {
    console.log("[release:workflow-status] publish_release_job=missing");
  } else {
    console.log(
      `[release:workflow-status] publish_release_job=${formatState(publishJob.status, publishJob.conclusion)}`
    );
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release:workflow-status] Failed: ${message}`);
  process.exit(1);
});
