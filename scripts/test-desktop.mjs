import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import electron from "electron";
const data = await mkdtemp(path.join(tmpdir(), "nexus-desktop-test-"));
const args = ["."];
// This opt-in exists only for controlled fixtures on root CI containers. Never
// use it for real downloaded applications. Packaged production refuses it.
if (process.argv.includes("--root-fixtures")) args.push("--no-sandbox");
const child = spawn(electron, args, {
  env: {
    ...process.env,
    NEXUS_FIXTURE_TEST: "1",
    NEXUS_TEST_SUITE: "1",
    NEXUS_TEST_DATA: data,
  },
  stdio: "inherit",
  shell: false,
});
const timer = setTimeout(() => child.kill("SIGKILL"), 150000);
child.on("error", (error) => {
  console.error(error.message);
});
child.on("close", async (code) => {
  clearTimeout(timer);
  await rm(data, { recursive: true, force: true });
  process.exitCode = code ?? 1;
});
