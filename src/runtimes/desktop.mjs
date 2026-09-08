import { BrowserWindow, session, ipcMain } from "electron";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { inspectWheel } from "../services/packages.mjs";
import { inside, envelope } from "../services/contracts.mjs";
import { HostError, bounded, check, publicError } from "../services/errors.mjs";
import {
  lockSession,
  lockContents,
  fileResponse,
  routePath,
  validSender,
  RUNTIME_CSP,
} from "../services/security.mjs";
export class DesktopRuntime {
  constructor({ base, pkg, generation, capability, onProgress, onCrash }) {
    Object.assign(this, {
      base,
      pkg,
      generation,
      capability,
      onProgress,
      onCrash,
    });
    this.pending = new Map();
    this.closed = false;
    this.ready = false;
    this.lastPong = Date.now();
    this.events = 0;
  }
  async start(signal) {
    signal?.throwIfAborted();
    const partition = session.fromPartition(`runtime-${this.generation}`, {
      cache: false,
    });
    const allowed = (url) =>
      url.startsWith("nexus-host://runtime/") ||
      url.startsWith(`nexus-pkg://${this.generation}/`) ||
      (this.pkg.manifest.runtime.kind === "python-wheel" &&
        url.startsWith("nexus-python://runtime/"));
    lockSession(partition, allowed);
    await partition.protocol.handle("nexus-host", (request) =>
      fileResponse(
        path.join(this.base, "src/runtimes"),
        routePath(request.url),
        RUNTIME_CSP,
      ),
    );
    await partition.protocol.handle("nexus-pkg", (request) =>
      fileResponse(this.pkg.root, routePath(request.url), RUNTIME_CSP),
    );
    await partition.protocol.handle("nexus-python", (request) =>
      fileResponse(
        path.join(this.base, "node_modules/pyodide"),
        routePath(request.url),
        RUNTIME_CSP,
      ),
    );
    let config = {
      kind: "esm",
      entry: `nexus-pkg://${this.generation}/${this.pkg.manifest.runtime.entry}`,
    };
    if (this.pkg.manifest.runtime.kind === "python-wheel") {
      const files = [];
      const names = new Set();
      let extracted = 0;
      for (const wheel of this.pkg.manifest.runtime.wheels) {
        signal?.throwIfAborted();
        for (const file of await inspectWheel(
          await readFile(await inside(this.pkg.root, wheel)),
          wheel,
        )) {
          extracted += file.bytes.length;
          check(
            extracted <= 16 * 1024 * 1024 && files.length < 1024,
            "LIMIT",
            "Combined wheels exceed the installation limit.",
          );
          check(
            !names.has(file.name),
            "WHEEL",
            "Wheels contain conflicting files.",
          );
          names.add(file.name);
          files.push(file);
        }
      }
      config = {
        kind: "python-wheel",
        entry: this.pkg.manifest.runtime.entry,
        files,
      };
    }
    signal?.throwIfAborted();
    const url = "nexus-host://runtime/index.html";
    this.window = new BrowserWindow({
      show: false,
      webPreferences: {
        session: partition,
        preload: path.join(this.base, "src/preload/runtime.cjs"),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        backgroundThrottling: false,
      },
    });
    lockContents(this.window.webContents, url);
    this.onMessage = (event, message) => {
      if (validSender(event, this.window?.webContents, url))
        this.receive(message);
    };
    this.onConnected = (event) => {
      if (validSender(event, this.window?.webContents, url))
        this.deliver({ v: 1, id: "startup", op: "activate", payload: config });
    };
    ipcMain.on("runtime:message", this.onMessage);
    ipcMain.on("runtime:connected", this.onConnected);
    this.window.webContents.on("render-process-gone", () =>
      this.fail(
        new HostError(
          "RUNTIME_CRASH",
          "The runtime process exited. Reload the application.",
        ),
      ),
    );
    const result = new Promise((resolve, reject) => {
      this.pending.set("startup", {
        resolve,
        reject,
        timer: setTimeout(
          () =>
            this.fail(
              new HostError("STARTUP_TIMEOUT", "Runtime startup timed out."),
            ),
          60000,
        ),
      });
    });
    this.abort = () =>
      this.fail(new HostError("CANCELLED", "Runtime startup cancelled."));
    signal?.addEventListener("abort", this.abort, { once: true });
    this.signal = signal;
    this.clock = setInterval(() => {
      this.events = 0;
      if (this.ready && Date.now() - this.lastPong > 10000)
        this.fail(
          new HostError(
            "RUNTIME_HUNG",
            "The runtime stopped responding. Reload to recover.",
          ),
        );
      else this.deliver({ v: 1, id: "heartbeat", op: "ping", payload: null });
    }, 2000);
    this.window
      .loadURL(url)
      .catch(() =>
        this.fail(
          new HostError("RUNTIME_START", "The runtime could not launch."),
        ),
      );
    return result;
  }
  deliver(message) {
    if (!this.closed && this.window && !this.window.isDestroyed())
      this.window.webContents.send("runtime:deliver", message);
  }
  async receive(raw) {
    if (this.closed) return;
    try {
      check(++this.events <= 200, "RATE", "Runtime message rate exceeded.");
      const message = envelope(raw, [
        "ready",
        "result",
        "progress",
        "error",
        "capability",
        "pong",
      ]);
      if (message.op === "pong") {
        this.lastPong = Date.now();
        return;
      }
      if (message.op === "capability") {
        check(
          typeof message.payload?.operation === "string",
          "PROTOCOL",
          "Invalid capability request.",
        );
        let payload;
        try {
          payload = {
            value: await this.capability(
              message.payload.operation,
              message.payload.payload,
            ),
          };
        } catch (error) {
          payload = { error: publicError(error) };
        }
        this.deliver({
          v: 1,
          id: message.id,
          op: "capability-result",
          payload,
        });
        return;
      }
      if (message.op === "progress") {
        check(
          typeof message.payload?.message === "string" &&
            message.payload.message.length <= 300,
          "PROTOCOL",
          "Invalid progress message.",
        );
        this.onProgress(message.payload.message);
        return;
      }
      if (message.op === "error") {
        const error = new HostError(
          "RUNTIME",
          String(
            message.payload?.message || "The runtime reported an error.",
          ).slice(0, 600),
        );
        if (message.id === "startup") return this.fail(error);
        this.settle(message.id, error);
        return;
      }
      if (message.op === "ready") {
        check(
          message.id === "startup" && !this.ready,
          "PROTOCOL",
          "Unexpected readiness message.",
        );
        this.ready = true;
        this.lastPong = Date.now();
        this.signal?.removeEventListener("abort", this.abort);
        this.settle("startup", null, null);
        return;
      }
      this.settle(message.id, null, message.payload);
    } catch (error) {
      this.fail(error);
    }
  }
  settle(id, error, value) {
    const pending = this.pending.get(id);
    if (!pending) return;
    this.pending.delete(id);
    clearTimeout(pending.timer);
    if (error) pending.reject(error);
    else pending.resolve(value);
  }
  request(method, data) {
    check(this.ready && !this.closed, "STOPPED", "The application is stopped.");
    check(
      typeof method === "string" && /^[a-zA-Z0-9_.-]{1,80}$/.test(method),
      "PROTOCOL",
      "Invalid method.",
    );
    bounded(data);
    check(this.pending.size < 32, "BUSY", "Too many runtime requests.");
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      this.pending.set(id, {
        resolve,
        reject,
        timer: setTimeout(
          () =>
            this.fail(
              new HostError(
                "REQUEST_TIMEOUT",
                "The application request timed out.",
              ),
            ),
          130000,
        ),
      });
      this.deliver({ v: 1, id, op: "request", payload: { method, data } });
    });
  }
  fail(error) {
    if (this.closed) return;
    this.stop(error);
    this.onCrash(publicError(error));
  }
  stop(error = new HostError("STOPPED", "The application was stopped.")) {
    if (this.closed) return;
    this.deliver({ v: 1, id: "stop", op: "stop", payload: null });
    this.closed = true;
    clearInterval(this.clock);
    this.signal?.removeEventListener("abort", this.abort);
    if (this.onMessage)
      ipcMain.removeListener("runtime:message", this.onMessage);
    if (this.onConnected)
      ipcMain.removeListener("runtime:connected", this.onConnected);
    for (const id of this.pending.keys()) this.settle(id, error);
    if (this.window && !this.window.isDestroyed()) this.window.destroy();
  }
}
