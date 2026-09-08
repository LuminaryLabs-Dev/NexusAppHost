import {
  app,
  BrowserWindow,
  ipcMain,
  protocol,
  session,
  dialog,
} from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
import { Storage, Logs } from "../services/storage.mjs";
import { Packages } from "../services/packages.mjs";
import { Codex } from "../integrations/codex/index.mjs";
import { Host } from "../services/host.mjs";
import { DesktopRuntime } from "../runtimes/desktop.mjs";
import { bounded, check, publicError } from "../services/errors.mjs";
import {
  lockSession,
  lockContents,
  fileResponse,
  routePath,
  validSender,
  HOST_CSP,
  UI_CSP,
} from "../services/security.mjs";
export const base = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const testMode = process.env.NEXUS_FIXTURE_TEST === "1" && !app.isPackaged;
if (app.commandLine.hasSwitch("no-sandbox") && !testMode) {
  console.error(
    "Nexus requires Chromium sandboxing. --no-sandbox is allowed only by the repository fixture harness.",
  );
  app.exit(1);
} else if (!testMode) app.enableSandbox();
protocol.registerSchemesAsPrivileged(
  ["nexus-host", "nexus-pkg", "nexus-python"].map((scheme) => ({
    scheme,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  })),
);
if (testMode && process.env.NEXUS_TEST_DATA)
  app.setPath("userData", process.env.NEXUS_TEST_DATA);
let host, window;
if (!testMode && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    window?.show();
    window?.focus();
  });
  app
    .whenReady()
    .then(async () => {
      const storage = new Storage(app.getPath("userData"));
      host = new Host({
        storage,
        packages: new Packages(storage),
        logs: new Logs(storage.root),
        codex: new Codex(),
        createRuntime: (options) => new DesktopRuntime({ base, ...options }),
        emit: (state) => {
          if (window && !window.isDestroyed())
            window.webContents.send("host:state", state);
        },
      });
      await host.initialize();
      const hostURL = "nexus-host://host/index.html",
        partition = session.fromPartition("host-shell", { cache: false });
      lockSession(
        partition,
        (url) =>
          url.startsWith("nexus-host://host/") ||
          (host.generation &&
            url.startsWith(`nexus-pkg://${host.generation}/`)) ||
          url.startsWith("data:"),
      );
      partition.protocol.handle("nexus-host", (request) =>
        fileResponse(
          path.join(base, "src/renderer"),
          routePath(request.url),
          HOST_CSP,
        ),
      );
      partition.protocol.handle("nexus-pkg", (request) => {
        if (!host.current || new URL(request.url).host !== host.generation)
          return new Response("Session stopped", { status: 410 });
        const rel = routePath(request.url);
        if (rel === "__nexus-sdk.js")
          return fileResponse(
            path.join(base, "src/renderer"),
            "sdk.js",
            UI_CSP,
          );
        return fileResponse(
          host.current.root,
          rel,
          UI_CSP,
          rel === host.current.manifest.ui
            ? (html) =>
                `<script src="nexus-pkg://${host.generation}/__nexus-sdk.js"></script>` +
                html
            : undefined,
        );
      });
      window = new BrowserWindow({
        width: 1220,
        height: 820,
        minWidth: 420,
        minHeight: 560,
        title: "Nexus App Host",
        backgroundColor: "#f6f7fb",
        autoHideMenuBar: true,
        show: !testMode,
        webPreferences: {
          session: partition,
          preload: path.join(base, "src/preload/bridge.cjs"),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          webSecurity: true,
          webviewTag: false,
          spellcheck: false,
        },
      });
      lockContents(window.webContents, hostURL);
      const reply = async (fn) => {
        try {
          return { ok: true, value: await fn() };
        } catch (error) {
          await host.logs.add("host", error.code || "FAILED", "failed");
          return { ok: false, error: publicError(error) };
        }
      };
      ipcMain.handle("host:invoke", (event, raw) =>
        reply(async () => {
          check(
            validSender(event, window.webContents, hostURL),
            "SENDER",
            "Unrecognized host sender.",
          );
          const { operation, payload } = bounded(raw, 65536);
          switch (operation) {
            case "state":
              return host.state;
            case "detect":
              return host.detect(payload);
            case "load":
              return host.load(payload);
            case "stop":
              return host.stop();
            case "cancel":
              return host.cancel();
            case "chooseFolder": {
              const result = await dialog.showOpenDialog(window, {
                title: "Select a Nexus application folder",
                properties: ["openDirectory"],
              });
              return result.canceled ? null : result.filePaths[0];
            }
            case "example":
              check(
                ["esm", "python"].includes(payload.kind),
                "SOURCE",
                "Unknown example.",
              );
              return {
                kind: "local",
                directory: path.join(base, "examples", payload.kind),
                manifestPath: "nexus-app.json",
              };
            case "logs":
              return host.logs.rows;
            case "exportLogs": {
              const result = await dialog.showSaveDialog(window, {
                defaultPath: "nexus-diagnostics.json",
                filters: [{ name: "JSON", extensions: ["json"] }],
              });
              if (!result.canceled && result.filePath)
                await writeFile(
                  result.filePath,
                  JSON.stringify(host.logs.rows, null, 2),
                );
              return !result.canceled;
            }
            case "clearCache":
              return host.clearCache();
            case "deleteData": {
              const pkg = host.candidate;
              check(
                pkg?.key === payload.key,
                "REVIEW_REQUIRED",
                "Inspect the application first.",
              );
              const result = await dialog.showMessageBox(window, {
                type: "warning",
                buttons: ["Keep data", "Delete saved data"],
                defaultId: 0,
                cancelId: 0,
                title: "Delete application data?",
                message: `Delete saved data for ${pkg.manifest.name}?`,
                detail:
                  "This only deletes data for this application and source. This cannot be undone.",
              });
              if (result.response === 1) return host.deleteData(payload.key);
              return false;
            }
            case "codexStatus":
              return host.codex.status();
            default:
              throw new Error("Unknown operation");
          }
        }),
      );
      ipcMain.handle("host:app", (event, payload) =>
        reply(() => {
          check(
            validSender(event, window.webContents, hostURL),
            "SENDER",
            "Unrecognized application relay.",
          );
          return host.appCall(bounded(payload));
        }),
      );
      window.on("closed", () => {
        host.cancel();
        host.stopRuntime();
        window = null;
        app.quit();
      });
      await window.loadURL(hostURL);
      if (testMode && process.env.NEXUS_TEST_SUITE) {
        const { run } = await import("../../tests/electron-suite.mjs");
        try {
          await run({ app, window, host, base });
          app.exit(0);
        } catch (error) {
          console.error(error.stack);
          app.exit(1);
        }
      }
    })
    .catch((error) => {
      console.error("Nexus startup failed:", error.code || error.name);
      app.exit(1);
    });
}
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  host?.cancel();
  host?.stopRuntime();
});
