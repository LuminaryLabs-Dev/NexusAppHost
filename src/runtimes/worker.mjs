import { PYTHON_BOOTSTRAP } from "./python-bootstrap.mjs";
// Runs in a Chromium Worker. No Node, filesystem, process or external network.
let implementation,
  python,
  api,
  started = false;
const waiting = new Map();
const send = (op, id, payload = null) => {
  const packet = { v: 1, id, op, payload };
  if (JSON.stringify(packet).length > 220000)
    throw new Error("Runtime output exceeds its limit.");
  postMessage(packet);
};
const capability = (operation, payload) =>
  new Promise((resolve, reject) => {
    if (waiting.size >= 32)
      return reject(new Error("Too many pending capability requests."));
    const id = crypto.randomUUID();
    const timer = setTimeout(() => {
      waiting.delete(id);
      reject(new Error("Capability request timed out."));
    }, 120000);
    waiting.set(id, { resolve, reject, timer });
    send("capability", id, { operation, payload });
  });
onmessage = async ({ data: message }) => {
  try {
    if (message.op === "ping") {
      send("pong", message.id);
      return;
    }
    if (message.op === "capability-result") {
      const pending = waiting.get(message.id);
      if (!pending) return;
      waiting.delete(message.id);
      clearTimeout(pending.timer);
      if (message.payload.error)
        pending.reject(new Error(message.payload.error.message));
      else pending.resolve(message.payload.value);
      return;
    }
    if (message.op === "activate" && !started) {
      started = true;
      api = Object.freeze({
        storage: Object.freeze({
          get: (key) => capability("storage.get", { key }),
          set: (key, value) => capability("storage.set", { key, value }),
        }),
        assess: (input) => capability("codex.assess", input),
        progress: (text) =>
          send("progress", "task", { message: String(text).slice(0, 300) }),
      });
      const config = message.payload;
      if (config.kind === "esm") {
        implementation = await import(config.entry);
        if (typeof implementation.request !== "function")
          throw new Error("ESM entry must export request(method, payload).");
        if (implementation.activate) await implementation.activate(api);
      } else {
        const { loadPyodide } =
          await import("nexus-python://runtime/pyodide.mjs");
        python = await loadPyodide({
          indexURL: "nexus-python://runtime/",
          stdout: () => {},
          stderr: () => {},
        });
        python.FS.mkdirTree("/app");
        for (const file of config.files) {
          const name = "/app/" + file.name;
          python.FS.mkdirTree(name.slice(0, name.lastIndexOf("/")));
          python.FS.writeFile(name, new Uint8Array(file.bytes));
        }
        python.globals.set("_nexus_entry", config.entry);
        python.globals.set("_nexus_capability", capability);
        python.globals.set("_nexus_progress", api.progress);
        await python.runPythonAsync(PYTHON_BOOTSTRAP);
      }
      send("ready", message.id);
      return;
    }
    if (message.op === "request") {
      if (!started) throw new Error("Runtime is not active.");
      let value;
      if (python) {
        const call = python.globals.get("_nexus_request");
        try {
          value = JSON.parse(
            await call(
              message.payload.method,
              JSON.stringify(message.payload.data),
            ),
          );
        } finally {
          call.destroy();
        }
      } else
        value = await implementation.request(
          message.payload.method,
          message.payload.data,
        );
      send("result", message.id, value ?? null);
    }
    if (message.op === "stop") {
      await implementation?.stop?.();
      for (const p of waiting.values()) {
        clearTimeout(p.timer);
        p.reject(new Error("Runtime stopped."));
      }
      waiting.clear();
      close();
    }
  } catch (error) {
    send("error", message.id, {
      code: "RUNTIME",
      message: String(error.message || error).slice(0, 600),
    });
  }
};
