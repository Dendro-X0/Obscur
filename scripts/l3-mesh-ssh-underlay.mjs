#!/usr/bin/env node
/**
 * R-RELAY-RUST-5c L3 — SSH underlay local-forward → Docker `:7000`.
 *
 * 1. Ensures product relay ws://127.0.0.1:7000
 * 2. Starts OpenSSH bastion container (port 2222) with ephemeral key
 * 3. Runs cargo test `l3_ssh_underlay_forward_to_docker_7000`
 * 4. Writes evidence under docs/handoffs/
 *
 * Usage: node scripts/l3-mesh-ssh-underlay.mjs
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const KEY_DIR = path.join(os.tmpdir(), "obscur-l3-ssh");
const IDENTITY = path.join(KEY_DIR, "id_ed25519");
const IDENTITY_PUB = `${IDENTITY}.pub`;
const BASTION_NAME = "obscur-l3-ssh-bastion";
const BASTION_PORT = Number(process.env.OBSCUR_L3_SSH_BASTION_PORT || 2222);
const LOCAL_PORT = Number(process.env.OBSCUR_L3_SSH_LOCAL_PORT || 19001);
const RELAY_HOST = "127.0.0.1";
const RELAY_PORT = 7000;

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`[${ok ? "PASS" : "FAIL"}] ${name}${detail ? ` — ${detail}` : ""}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const tcpOpen = (host, port, ms = 2000) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const t = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, ms);
    socket.once("connect", () => {
      clearTimeout(t);
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(t);
      resolve(false);
    });
  });

const run = (command, args, opts = {}) => {
  const { env: optsEnv, ...rest } = opts;
  return spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: false,
    ...rest,
    env: { ...process.env, MSYS_NO_PATHCONV: "1", ...(optsEnv || {}) },
  });
};

const ensureKeys = () => {
  fs.mkdirSync(KEY_DIR, { recursive: true });
  if (fs.existsSync(IDENTITY) && fs.existsSync(IDENTITY_PUB)) {
    return;
  }
  const gen = run("ssh-keygen", [
    "-t",
    "ed25519",
    "-f",
    IDENTITY,
    "-N",
    "",
    "-C",
    "obscur-l3-ssh",
  ]);
  if (gen.status !== 0) {
    throw new Error(`ssh-keygen failed: ${gen.stderr || gen.stdout}`);
  }
};

const ensureBastion = async () => {
  run("docker", ["rm", "-f", BASTION_NAME]);
  const pub = fs.readFileSync(IDENTITY_PUB, "utf8").trim();
  const start = run("docker", [
    "run",
    "-d",
    "--name",
    BASTION_NAME,
    "--add-host",
    "host.docker.internal:host-gateway",
    "-e",
    "PUID=1000",
    "-e",
    "PGID=1000",
    "-e",
    "TZ=UTC",
    "-e",
    "USER_NAME=ops",
    "-e",
    `PUBLIC_KEY=${pub}`,
    "-p",
    `${BASTION_PORT}:2222`,
    "lscr.io/linuxserver/openssh-server:latest",
  ], { env: { ...process.env, MSYS_NO_PATHCONV: "1" } });
  if (start.status !== 0) {
    throw new Error(`docker run bastion failed: ${start.stderr || start.stdout}`);
  }
  run("docker", ["network", "connect", "infra_default", BASTION_NAME]);
  for (let i = 0; i < 40; i += 1) {
    if (await tcpOpen("127.0.0.1", BASTION_PORT, 1000)) {
      await sleep(4000);
      // Real sshd config for linuxserver image lives under /config/sshd/.
      const sed = run(
        "docker",
        [
          "exec",
          BASTION_NAME,
          "sed",
          "-i",
          "s/^AllowTcpForwarding no/AllowTcpForwarding yes/",
          "/config/sshd/sshd_config",
        ],
        { env: { ...process.env, MSYS_NO_PATHCONV: "1" } },
      );
      if (sed.status !== 0) {
        throw new Error(`enable AllowTcpForwarding failed: ${sed.stderr || sed.stdout}`);
      }
      run("docker", ["restart", BASTION_NAME]);
      for (let j = 0; j < 40; j += 1) {
        if (await tcpOpen("127.0.0.1", BASTION_PORT, 1000)) {
          await sleep(2000);
          return;
        }
        await sleep(500);
      }
      throw new Error("bastion did not come back after sshd restart");
    }
    await sleep(500);
  }
  throw new Error(`bastion port ${BASTION_PORT} never opened`);
};

const resolveRelayRemote = () => {
  const inspect = run("docker", [
    "inspect",
    "-f",
    "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}",
    "infra-nostr-relay-1",
  ]);
  const ip = (inspect.stdout || "").trim().split(/\s+/)[0];
  if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
    return { host: ip, port: 8080 };
  }
  return { host: "host.docker.internal", port: 7000 };
};

const probeSsh = async () => {
  for (let i = 0; i < 20; i += 1) {
    const probe = run(
      "ssh",
      [
        "-i",
        IDENTITY,
        "-p",
        String(BASTION_PORT),
        "-o",
        "BatchMode=yes",
        "-o",
        "StrictHostKeyChecking=accept-new",
        "-o",
        "ConnectTimeout=5",
        "ops@127.0.0.1",
        "echo",
        "obscur-bastion-ok",
      ],
      { timeout: 20_000 },
    );
    const out = `${probe.stdout || ""}${probe.stderr || ""}`;
    if (probe.status === 0 && out.includes("obscur-bastion-ok")) {
      return true;
    }
    await sleep(1000);
  }
  return false;
};

const main = async () => {
  console.log("R-RELAY-RUST-5c L3 SSH underlay soak");

  const relayUp = await tcpOpen(RELAY_HOST, RELAY_PORT);
  record("product_relay_7000", relayUp, relayUp ? "listening" : "start pnpm dev:relay:docker");
  if (!relayUp) {
    process.exitCode = 1;
    return;
  }

  ensureKeys();
  record("ssh_identity", fs.existsSync(IDENTITY), IDENTITY);

  await ensureBastion();
  record("bastion_container", true, `${BASTION_NAME} :${BASTION_PORT}`);

  // Host key rotates each container recreate — drop stale entry so BatchMode works.
  run("ssh-keygen", ["-R", `[127.0.0.1]:${BASTION_PORT}`]);

  const sshOk = await probeSsh();
  record("bastion_ssh_login", sshOk, sshOk ? "ops@127.0.0.1 BatchMode" : "key auth failed");
  if (!sshOk) {
    process.exitCode = 1;
    return;
  }

  const remote = resolveRelayRemote();
  record("relay_remote_for_forward", true, `${remote.host}:${remote.port}`);

  // Free local bind if a prior soak left ssh -L running.
  run("taskkill", ["/F", "/IM", "ssh.exe"]);

  const cargo = run(
    "cargo",
    ["test", "--lib", "l3_ssh_underlay_forward_to_docker_7000", "--", "--nocapture"],
    {
      cwd: path.join(repoRoot, "apps/desktop/src-tauri"),
      env: {
        ...process.env,
        OBSCUR_L3_SSH_IDENTITY: IDENTITY,
        OBSCUR_L3_SSH_BASTION_PORT: String(BASTION_PORT),
        OBSCUR_L3_SSH_LOCAL_PORT: String(LOCAL_PORT),
        OBSCUR_L3_SSH_USER: "ops",
        OBSCUR_L3_SSH_REMOTE_HOST: remote.host,
        OBSCUR_L3_SSH_REMOTE_PORT: String(remote.port),
      },
      timeout: 180_000,
    },
  );
  const cargoOut = `${cargo.stdout || ""}\n${cargo.stderr || ""}`;
  const cargoOk =
    cargo.status === 0
    && cargoOut.includes("l3_ssh_underlay_forward_to_docker_7000")
    && !cargoOut.includes("skip L3-SSH")
    && cargoOut.includes("test result: ok");
  record(
    "cargo_l3_ssh_underlay",
    cargoOk,
    cargoOk ? "mesh configure→forward→REQ Pass" : cargoOut.slice(-800),
  );

  const allOk = results.every((r) => r.ok);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const evidence = {
    slice: "RUST-5c",
    at: new Date().toISOString(),
    ok: allOk,
    relay: `ws://${RELAY_HOST}:${RELAY_PORT}`,
    bastion: `ops@127.0.0.1:${BASTION_PORT}`,
    localForward: `127.0.0.1:${LOCAL_PORT} → ${remote.host}:${remote.port}`,
    dialUrl: `ws://127.0.0.1:${LOCAL_PORT}`,
    results,
  };
  const jsonPath = path.join(
    repoRoot,
    "docs/handoffs",
    `r-relay-rust-l3-ssh-underlay-${stamp.slice(0, 10)}.json`,
  );
  const mdPath = path.join(
    repoRoot,
    "docs/handoffs",
    `r-relay-rust-l3-ssh-underlay-${stamp.slice(0, 10)}.md`,
  );
  fs.writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  fs.writeFileSync(
    mdPath,
    `# R-RELAY-RUST-5c L3 SSH underlay soak

- **When:** ${evidence.at}
- **Outcome:** ${allOk ? "Pass" : "Fail"}
- **Relay:** ${evidence.relay}
- **Bastion:** ${evidence.bastion}
- **Forward:** ${evidence.localForward}
- **Dial:** ${evidence.dialUrl}

## Checks

${results.map((r) => `- [${r.ok ? "x" : " "}] **${r.name}** — ${r.detail || ""}`).join("\n")}

## Claim

| May say | When |
|---------|------|
| SSH path fixed (L3) | This soak Pass |
| Offline ready | Never from this file |

\`\`\`bash
node scripts/l3-mesh-ssh-underlay.mjs
\`\`\`
`,
    "utf8",
  );
  console.log(`\nEvidence: ${mdPath}`);
  process.exitCode = allOk ? 0 : 1;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
