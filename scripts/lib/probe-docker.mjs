import { spawn } from "node:child_process";

/** Returns true when the Docker daemon responds to `docker info`. */
export const probeDockerDaemon = () => new Promise((resolve) => {
  const child = spawn("docker", ["info"], { stdio: "ignore", shell: false });
  child.on("error", () => resolve(false));
  child.on("exit", (code) => resolve(code === 0));
});
