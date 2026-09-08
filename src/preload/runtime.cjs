const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "runtimeBridge",
  Object.freeze({
    send: (packet) => ipcRenderer.send("runtime:message", packet),
    receive: (callback) =>
      ipcRenderer.on("runtime:deliver", (_event, message) => callback(message)),
    connected: () => ipcRenderer.send("runtime:connected"),
  }),
);
