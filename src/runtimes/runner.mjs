const worker = new Worker(new URL("./worker.mjs", import.meta.url), {
  type: "module",
});
worker.onmessage = ({ data }) => window.runtimeBridge.send(data);
worker.onerror = () =>
  window.runtimeBridge.send({
    v: 1,
    id: "startup",
    op: "error",
    payload: {
      code: "RUNTIME_CRASH",
      message:
        "The runtime failed to execute. Check the entry module and supported imports.",
    },
  });
window.runtimeBridge.receive((message) => worker.postMessage(message));
window.runtimeBridge.connected();
