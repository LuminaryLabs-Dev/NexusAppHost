const { contextBridge, ipcRenderer } = require("electron");
const operations = new Set([
  "state",
  "detect",
  "load",
  "stop",
  "cancel",
  "chooseFolder",
  "example",
  "logs",
  "exportLogs",
  "clearCache",
  "deleteData",
  "codexStatus",
]);
contextBridge.exposeInMainWorld(
  "nexusHost",
  Object.freeze({
    invoke: (operation, payload = {}) => {
      if (!operations.has(operation))
        return Promise.reject(new Error("Unknown host operation."));
      return ipcRenderer.invoke("host:invoke", { operation, payload });
    },
    appCall: (payload) => ipcRenderer.invoke("host:app", payload),
    subscribe: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on("host:state", listener);
      return () => ipcRenderer.removeListener("host:state", listener);
    },
  }),
);
