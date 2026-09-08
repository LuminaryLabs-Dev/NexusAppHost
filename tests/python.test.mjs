import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadPyodide } from "pyodide";
import { inspectWheel } from "../src/services/packages.mjs";
import { PYTHON_BOOTSTRAP } from "../src/runtimes/python-bootstrap.mjs";
test("real bundled Python interpreter loads the wheel, handles requests and persists structured data", async () => {
  const py = await loadPyodide({ stdout: () => {}, stderr: () => {} });
  const data = new Map(),
    progress = [];
  py.FS.mkdirTree("/app");
  for (const file of await inspectWheel(
    await readFile(
      new URL(
        "../examples/python/signal_check-1.0.0-py3-none-any.whl",
        import.meta.url,
      ),
    ),
    "signal_check-1.0.0-py3-none-any.whl",
  )) {
    const name = "/app/" + file.name;
    py.FS.mkdirTree(name.slice(0, name.lastIndexOf("/")));
    py.FS.writeFile(name, new Uint8Array(file.bytes));
  }
  py.globals.set("_nexus_entry", "signal_check:request");
  py.globals.set("_nexus_capability", async (operation, payload) => {
    assert.equal(typeof payload.key, "string");
    if (operation === "storage.get") return data.get(payload.key) ?? null;
    assert.equal(operation, "storage.set");
    data.set(payload.key, JSON.parse(JSON.stringify(payload.value)));
    return payload.value;
  });
  py.globals.set("_nexus_progress", (text) => progress.push(text));
  await py.runPythonAsync(PYTHON_BOOTSTRAP);
  const call = py.globals.get("_nexus_request");
  try {
    assert.equal(JSON.parse(await call("history", "null")), null);
    const result = JSON.parse(
      await call(
        "check",
        JSON.stringify({ text: "Construction safety training" }),
      ),
    );
    assert.deepEqual(result.matchedSignals, [
      "training",
      "construction",
      "safety",
    ]);
    assert.equal(result.status, "needs-human-review");
    assert.deepEqual(JSON.parse(await call("history", "null")), result);
    assert.equal(progress.length, 1);
  } finally {
    call.destroy();
  }
});
