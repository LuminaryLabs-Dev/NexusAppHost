import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  mkdir,
  symlink,
  readdir,
  rm,
  cp,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { manifest, safePath, envelope } from "../src/services/contracts.mjs";
import { Storage, Logs, hash, json } from "../src/services/storage.mjs";
import {
  Packages,
  repository,
  inspectWheel,
} from "../src/services/packages.mjs";
import { Host } from "../src/services/host.mjs";
import {
  assessmentInput,
  assessmentOutput,
  processRun,
  Codex,
} from "../src/integrations/codex/index.mjs";
import { validSender, UI_CSP, RUNTIME_CSP } from "../src/services/security.mjs";
const example = JSON.parse(
  await readFile(new URL("../examples/esm/nexus-app.json", import.meta.url)),
);
async function setup(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "nexus-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const storage = new Storage(path.join(root, "host"));
  await storage.init();
  const source = path.join(root, "app");
  await cp(new URL("../examples/esm/", import.meta.url), source, {
    recursive: true,
  });
  return { root, source, storage, packages: new Packages(storage) };
}
test("manifest accepts the real ESM and Python contracts", async () => {
  assert.equal(manifest(structuredClone(example)).hostApi, 1);
  assert.equal(
    manifest(
      JSON.parse(
        await readFile(
          new URL("../examples/python/nexus-app.json", import.meta.url),
        ),
      ),
    ).runtime.kind,
    "python-wheel",
  );
});
test("manifest rejects unknown fields, APIs, capabilities and absent entries", () => {
  for (const patch of [
    { hostApi: 2 },
    { schemaVersion: 2 },
    { extra: true },
    { capabilities: ["shell"] },
    { runtime: { kind: "node", entry: "x" } },
    { ui: "/tmp/page.html" },
    { version: "latest" },
  ])
    assert.throws(() => manifest({ ...structuredClone(example), ...patch }));
  const missing = structuredClone(example);
  delete missing.id;
  assert.throws(() => manifest(missing));
});
test("package paths reject traversal, special encodings, drives and separators", () => {
  for (const item of [
    "../secret",
    "/absolute",
    "a/../b",
    "a\\b",
    "C:/test",
    "a//b",
    "%2e%2e/x",
    "a?b",
    "a#b",
    "a\0b",
    "./a",
  ])
    assert.throws(() => safePath(item));
  assert.equal(safePath("ui/main.html"), "ui/main.html");
});
test("wire messages reject foreign versions, missing IDs and oversized output", () => {
  assert.equal(
    envelope({ v: 1, id: "hello", op: "ready", payload: null }, ["ready"]).op,
    "ready",
  );
  for (const value of [
    { v: 2, id: "ok", op: "ready" },
    { v: 1, op: "ready" },
    { v: 1, id: "ok", op: "shell" },
    { v: 1, id: "ok", op: "ready", payload: "x".repeat(300000) },
  ])
    assert.throws(() => envelope(value, ["ready"]));
});
test("GitHub source normalization accepts only the public repository form", () => {
  assert.equal(
    repository("https://github.com/LuminaryLabs-Dev/NexusAppHost.git"),
    "luminarylabs-dev/nexusapphost",
  );
  for (const item of [
    "http://github.com/a/b",
    "https://evil.test/a/b",
    "a/b/tree/main",
    "a/../b",
    "a/b?token=x",
  ])
    assert.throws(() => repository(item));
});
test("local snapshots are stable and explicit reinspection observes edits", async (t) => {
  const { source, packages } = await setup(t);
  const first = await packages.detect({ kind: "local", directory: source });
  await writeFile(
    path.join(source, "runtime.mjs"),
    "export function request(){return 2}",
  );
  assert.match(
    await readFile(path.join(first.root, "runtime.mjs"), "utf8"),
    /Field Notes/,
  );
  const next = await packages.detect({ kind: "local", directory: source });
  assert.notEqual(first.key, next.key);
  assert.equal(first.origin, next.origin);
});
test("symlinks and missing entries fail before execution", async (t) => {
  const { source, packages } = await setup(t);
  await symlink("/etc/passwd", path.join(source, "escape"));
  await assert.rejects(packages.detect({ kind: "local", directory: source }), {
    code: "PATH",
  });
  await rm(path.join(source, "escape"));
  await rm(path.join(source, "runtime.mjs"));
  await assert.rejects(packages.detect({ kind: "local", directory: source }));
});
test("cancelled inspection cleans its stage and retains an earlier package", async (t) => {
  const { source, packages, storage } = await setup(t);
  const good = await packages.detect({ kind: "local", directory: source });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    packages.detect({ kind: "local", directory: source }, controller.signal),
  );
  assert.equal(
    (await readFile(path.join(good.root, "nexus-app.json"), "utf8")).length > 0,
    true,
  );
  assert.deepEqual(await readdir(path.join(storage.root, "staging")), []);
});
test("GitHub branch, tag and SHA retrieval pins every file to resolved commit", async (t) => {
  const { storage } = await setup(t);
  const sha = "a".repeat(40);
  const files = {
    "nexus-app.json": JSON.stringify(example),
    "index.html": "<h1>test</h1>",
    "runtime.mjs": "export function request() { return 1; }",
  };
  const blobs = Object.entries(files).map(([name, data], i) => ({
    path: name,
    mode: "100644",
    type: "blob",
    size: Buffer.byteLength(data),
    sha: String(i).repeat(40),
  }));
  const calls = [];
  const packages = new Packages(storage, {
    fetcher: async (url) => {
      calls.push(url);
      let output;
      if (url.endsWith("/nexusapphost"))
        output = { default_branch: "main", private: false };
      else if (url.includes("/commits/")) output = { sha };
      else if (url.includes("/git/trees/"))
        output = { truncated: false, tree: blobs };
      else {
        const index = blobs.findIndex((b) => url.endsWith(b.sha));
        output = {
          encoding: "base64",
          content: Buffer.from(Object.values(files)[index]).toString("base64"),
        };
      }
      return Response.json(output);
    },
  });
  for (const ref of ["", "v1.0.0", sha]) {
    const pkg = await packages.detect({
      kind: "github",
      repository: "LuminaryLabs-Dev/NexusAppHost",
      ref,
    });
    assert.equal(pkg.revision, sha);
  }
  assert(
    calls
      .filter((url) => url.includes("/git/trees/"))
      .every((url) => url.includes(sha)),
  );
});
test("GitHub errors distinguish rate limiting and unavailable/private sources", async (t) => {
  const { storage } = await setup(t);
  for (const [status, code] of [
    [403, "RATE_LIMIT"],
    [404, "NOT_FOUND"],
    [401, "AUTH_REQUIRED"],
  ]) {
    const packages = new Packages(storage, {
      fetcher: async () => new Response("", { status }),
    });
    await assert.rejects(
      packages.detect({ kind: "github", repository: "a/b" }),
      { code },
    );
  }
});
test("origin-bound storage survives version changes and excludes impostor IDs", async (t) => {
  const { source, packages, storage } = await setup(t);
  const pkg = await packages.detect({ kind: "local", directory: source });
  await storage.prepare(pkg);
  await storage.set(pkg, "note", "preserved");
  const next = { ...pkg, manifest: { ...pkg.manifest, version: "1.1.0" } };
  await storage.prepare(next);
  assert.equal(await storage.get(next, "note"), "preserved");
  const impostor = { ...pkg, origin: "github:someone/else:." };
  await storage.prepare(impostor);
  assert.equal(await storage.get(impostor, "note"), null);
  await assert.rejects(
    storage.prepare({
      ...pkg,
      manifest: { ...pkg.manifest, dataSchemaVersion: 2 },
    }),
    { code: "DATA_SCHEMA" },
  );
});
test("concurrent writes retain both keys, reject path keys and quotas", async (t) => {
  const { source, packages, storage } = await setup(t);
  const pkg = await packages.detect({ kind: "local", directory: source });
  await storage.prepare(pkg);
  await Promise.all([storage.set(pkg, "a", 1), storage.set(pkg, "b", 2)]);
  assert.equal(await storage.get(pkg, "a"), 1);
  assert.equal(await storage.get(pkg, "b"), 2);
  await assert.rejects(storage.set(pkg, "../secret", 1));
  await assert.rejects(storage.set(pkg, "huge", "x".repeat(70000)));
});
test("clearing cache preserves active code and saved data", async (t) => {
  const { source, packages, storage } = await setup(t);
  const pkg = await packages.detect({ kind: "local", directory: source });
  await storage.prepare(pkg);
  await storage.set(pkg, "note", "safe");
  await storage.clearCache(pkg.key);
  assert.equal(await storage.get(pkg, "note"), "safe");
  assert.match(
    await readFile(path.join(pkg.root, "runtime.mjs"), "utf8"),
    /request/,
  );
  await storage.clearCache(null);
  assert.equal(await storage.get(pkg, "note"), "safe");
});
test("Python wheel passes pure metadata checks; dependencies/native hooks fail", async () => {
  const data = await readFile(
    new URL(
      "../examples/python/signal_check-1.0.0-py3-none-any.whl",
      import.meta.url,
    ),
  );
  const files = await inspectWheel(data, "sample-1.0.0-py3-none-any.whl");
  assert(files.some((f) => f.name === "signal_check.py"));
  await assert.rejects(inspectWheel(data, "sample-cp314-win_amd64.whl"), {
    code: "WHEEL",
  });
  for (const variant of ["hook.pth", "native.so", "dependencies"]) {
    const zip = await JSZip.loadAsync(data);
    if (variant === "dependencies") {
      const entry = "signal_check-1.0.0.dist-info/METADATA";
      zip.file(
        entry,
        (await zip.file(entry).async("string")) + "Requires-Dist: unknown\n",
      );
    } else zip.file(variant, "x");
    await assert.rejects(
      inspectWheel(
        await zip.generateAsync({ type: "nodebuffer" }),
        "sample-1.0.0-py3-none-any.whl",
      ),
    );
  }
});
test("wheel zip traversal is rejected before extraction", async () => {
  const zip = new JSZip();
  zip.file("../escape.py", "x");
  await assert.rejects(
    inspectWheel(
      await zip.generateAsync({ type: "nodebuffer" }),
      "x-1.0.0-py3-none-any.whl",
    ),
    { code: "PATH" },
  );
});
test("IPC validation rejects child frames and foreign web contents", () => {
  const mainFrame = { url: "nexus-host://host/index.html" },
    contents = { mainFrame };
  assert(
    validSender(
      { sender: contents, senderFrame: mainFrame },
      contents,
      mainFrame.url,
    ),
  );
  assert(
    !validSender(
      { sender: contents, senderFrame: { url: mainFrame.url } },
      contents,
      mainFrame.url,
    ),
  );
  assert(
    !validSender(
      { sender: {}, senderFrame: mainFrame },
      contents,
      mainFrame.url,
    ),
  );
  assert(UI_CSP.includes("connect-src 'none'"));
  assert(!RUNTIME_CSP.includes("https:"));
});
test("logs never persist raw prompts, secrets or exception details", async (t) => {
  const { storage } = await setup(t);
  const logs = new Logs(storage.root);
  await logs.init();
  await logs.add("runtime", "FAILED", "token=secret email=person@example.com");
  assert(!JSON.stringify(await json(logs.file)).includes("secret"));
  assert(!JSON.stringify(logs.rows).includes("@"));
});
test("host enforces review, grants and revokes old generation access", async (t) => {
  const { source, storage, packages } = await setup(t);
  let stopped = 0;
  const host = new Host({
    storage,
    packages,
    logs: new Logs(storage.root),
    codex: {},
    createRuntime: () => ({
      start: async () => {},
      stop: () => stopped++,
      request: async () => 1,
    }),
  });
  await host.initialize();
  await host.detect({ kind: "local", directory: source });
  await assert.rejects(host.load({ key: "forged", grants: [] }));
  await host.load({ key: host.candidate.key, grants: ["storage"] });
  const generation = host.generation;
  await host.appCall({
    generation,
    operation: "storage.set",
    payload: { key: "note", value: "ok" },
  });
  await assert.rejects(
    host.appCall({ generation, operation: "codex.assess", payload: {} }),
    { code: "DENIED" },
  );
  host.stop();
  assert.equal(stopped, 1);
  await assert.rejects(
    host.appCall({
      generation,
      operation: "storage.get",
      payload: { key: "note" },
    }),
    { code: "STOPPED" },
  );
});
test("host detects cache tampering and refuses to execute", async (t) => {
  const { source, storage, packages } = await setup(t);
  let launched = false;
  const host = new Host({
    storage,
    packages,
    logs: new Logs(storage.root),
    codex: {},
    createRuntime: () => {
      launched = true;
    },
  });
  await host.initialize();
  await host.detect({ kind: "local", directory: source });
  await writeFile(path.join(host.candidate.root, "runtime.mjs"), "changed");
  await assert.rejects(host.load({ key: host.candidate.key, grants: [] }), {
    code: "INTEGRITY",
  });
  assert.equal(launched, false);
});
test("assessment contract rejects invented evidence and approval fields", () => {
  const input = assessmentInput({
    schema: "lead-assessment-v1",
    criteria: ["training"],
    evidence: [{ id: "a", text: "Company offers training." }],
  });
  const output = {
    strengths: ["Training"],
    weaknesses: [],
    missingInformation: ["Decision maker"],
    nextSteps: ["Verify"],
    evidenceIds: ["a"],
  };
  assert.equal(assessmentOutput(output, input), output);
  assert.throws(() => assessmentOutput({ ...output, approved: true }, input));
  assert.throws(() =>
    assessmentOutput({ ...output, evidenceIds: ["invented"] }, input),
  );
  assert.throws(() =>
    assessmentInput({
      ...input,
      evidence: [{ id: "a", text: "x", command: "rm" }],
    }),
  );
});
test("Codex status distinguishes CLI absence and missing authentication", async () => {
  const absent = new Codex({
    run: async () => {
      throw new Error("CLI unavailable");
    },
  });
  assert.equal((await absent.status()).available, false);
  const cli = new Codex({
    run: async (_cmd, args) => ({
      code: args[0] === "login" ? 1 : 0,
      output:
        args[0] === "exec"
          ? "--output-schema --json --ephemeral --sandbox"
          : "codex 1.0",
    }),
  });
  const status = await cli.status();
  assert.equal(status.available, true);
  assert.equal(status.authenticated, false);
});
test("process adapter has bounded output, cancellation and timeout", async () => {
  await assert.rejects(
    processRun(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      timeout: 50,
    }),
    { code: "CODEX_TIMEOUT" },
  );
  await assert.rejects(
    processRun(process.execPath, ["-e", 'console.log("x".repeat(5000))'], {
      limit: 100,
    }),
    { code: "CODEX_OUTPUT" },
  );
  const controller = new AbortController();
  const pending = processRun(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    { signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(pending, { code: "CANCELLED" });
});
