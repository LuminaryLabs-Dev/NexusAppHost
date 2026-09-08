// Injected into the app's opaque-origin sandboxed frame. No host controls.
(() => {
  let port;
  const waiting = new Map();
  let resolveReady;
  const ready = new Promise((resolve) => (resolveReady = resolve));
  addEventListener("message", (event) => {
    if (
      event.source !== parent ||
      event.data?.type !== "nexus:connect" ||
      port ||
      event.ports.length !== 1
    )
      return;
    port = event.ports[0];
    port.onmessage = ({ data }) => {
      const pending = waiting.get(data.id);
      if (!pending) return;
      waiting.delete(data.id);
      clearTimeout(pending.timer);
      if (data.error)
        pending.reject(
          Object.assign(new Error(data.error.message), {
            code: data.error.code,
          }),
        );
      else pending.resolve(data.value);
    };
    port.start();
    resolveReady();
  });
  parent.postMessage({ type: "nexus:hello" }, "*");
  const call = async (operation, payload) => {
    await ready;
    if (waiting.size >= 32) throw new Error("Too many outstanding requests.");
    if (JSON.stringify(payload).length > 200000)
      throw new Error("Payload exceeds size limit.");
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID(),
        timer = setTimeout(() => {
          waiting.delete(id);
          reject(new Error("Host request timed out."));
        }, 125000);
      waiting.set(id, { resolve, reject, timer });
      port.postMessage({ id, operation, payload });
    });
  };
  Object.defineProperty(window, "nexus", {
    value: Object.freeze({
      ready,
      request: (method, data = null) =>
        call("runtime.request", { method, data }),
      storage: Object.freeze({
        get: (key) => call("storage.get", { key }),
        set: (key, value) => call("storage.set", { key, value }),
      }),
      assess: (input) => call("codex.assess", input),
    }),
    writable: false,
  });
})();
