// Native application integration; no browser automation or user data. The
// fixture harness exercises the actual isolated renderer/Worker transport.
import assert from "node:assert/strict";
import { cp, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
export async function run({ window, host, base }) {
  const report = [];
  let uiRead = false;
  const appCall = host.appCall.bind(host);
  host.appCall = (payload) => {
    if (
      payload.operation === "runtime.request" &&
      payload.payload?.method === "read"
    )
      uiRead = true;
    return appCall(payload);
  };
  const until = (predicate) =>
    new Promise((resolve, reject) => {
      const deadline = Date.now() + 5000;
      const tick = () => {
        if (predicate()) resolve();
        else if (Date.now() > deadline)
          reject(new Error("UI bridge did not connect within five seconds"));
        else setTimeout(tick, 20);
      };
      tick();
    });
  const record = (name) => {
    report.push({ name, passed: true });
    console.log("PASS", name);
  };
  assert.equal(
    window.webContents.getLastWebPreferences().nodeIntegration,
    false,
  );
  assert.equal(window.webContents.getLastWebPreferences().sandbox, true);
  record("Desktop shell launches with isolated renderer preferences");
  const load = async (directory) => {
    await host.detect({ kind: "local", directory });
    await host.load({ key: host.candidate.key, grants: ["storage"] });
  };
  await load(path.join(base, "examples/esm"));
  await until(() => uiRead);
  record(
    "Hosted HTML automatically connects its SDK to the main-process capability relay",
  );
  const firstGeneration = host.generation;
  assert.deepEqual(
    await host.runtime.request("save", { text: "Native fixture note" }),
    { saved: true, characters: 19 },
  );
  assert.equal(await host.runtime.request("read", null), "Native fixture note");
  record("ESM runtime activation, requests, capabilities and persistence");
  host.stop();
  await assert.rejects(
    host.appCall({
      generation: firstGeneration,
      operation: "storage.get",
      payload: { key: "note" },
    }),
  );
  await load(path.join(base, "examples/esm"));
  assert.equal(await host.runtime.request("read", null), "Native fixture note");
  record("Stop, revocation and reload preserve saved data");
  await load(path.join(base, "examples/python"));
  const value = await host.runtime.request("check", {
    text: "Construction safety training",
  });
  assert.deepEqual(value.matchedSignals, [
    "training",
    "construction",
    "safety",
  ]);
  assert.equal(value.status, "needs-human-review");
  assert.deepEqual(await host.runtime.request("history", null), value);
  record("Python wheel installs and executes in the actual renderer Worker");
  const fixture = path.join(host.storage.root, "fixture-package");
  await cp(path.join(base, "examples/esm"), fixture, { recursive: true });
  const metadata = JSON.parse(
    await readFile(path.join(fixture, "nexus-app.json"), "utf8"),
  );
  metadata.id = "dev.luminary.hostile-fixture";
  metadata.capabilities = [];
  await writeFile(
    path.join(fixture, "nexus-app.json"),
    JSON.stringify(metadata),
  );
  await writeFile(
    path.join(fixture, "runtime.mjs"),
    `let host;export function activate(api){host=api;}export async function request(method){if(method==='node')return import('node:fs');if(method==='network')return fetch('https://example.com');if(method==='file')return fetch('file:///etc/passwd');if(method==='denied')return host.storage.get('note');if(method==='oversize')return 'x'.repeat(300000);if(method==='hang')while(true){};return 'alive';}`,
  );
  await host.detect({ kind: "local", directory: fixture });
  await host.load({ key: host.candidate.key, grants: [] });
  for (const method of ["node", "network", "file", "denied", "oversize"]) {
    await assert.rejects(host.runtime.request(method, null));
    assert.equal(await host.runtime.request("okay", null), "alive");
  }
  record(
    "Unsupported imports, external network, native files, ungranted storage and oversized output are denied",
  );
  await assert.rejects(host.runtime.request("hang", null));
  assert.equal(host.runtime, null);
  await load(path.join(base, "examples/esm"));
  assert.equal(await host.runtime.request("read", null), "Native fixture note");
  record("Infinite loop is terminated and the host loads a replacement");
  host.stop();
  await host.logs.pending;
  await mkdir(path.join(base, "validation"), { recursive: true });
  await writeFile(
    path.join(base, "validation/native-results.json"),
    JSON.stringify(
      {
        runtime: process.versions,
        chromiumSandboxTested: !process.argv.includes("--no-sandbox"),
        results: report,
      },
      null,
      2,
    ),
  );
}
