import { readFile } from "node:fs/promises";
import path from "node:path";
import { inside } from "./contracts.mjs";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".zip": "application/zip",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
};
export const HOST_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-src nexus-pkg:; connect-src 'none'; base-uri 'none'; form-action 'none'";
export const UI_CSP =
  "default-src 'none'; script-src nexus-pkg: 'unsafe-inline'; style-src nexus-pkg: 'unsafe-inline'; img-src nexus-pkg: data:; font-src nexus-pkg:; connect-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts";
export const RUNTIME_CSP =
  "default-src 'none'; script-src 'self' nexus-pkg: nexus-python: 'wasm-unsafe-eval'; worker-src 'self'; connect-src nexus-pkg: nexus-python:; base-uri 'none'; form-action 'none'";
export function lockSession(session, allowed) {
  session.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  );
  session.setPermissionCheckHandler(() => false);
  session.on("will-download", (event) => event.preventDefault());
  session.webRequest.onBeforeRequest((details, callback) =>
    callback({ cancel: !allowed(details.url) }),
  );
}
export function lockContents(contents, initialURL) {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-attach-webview", (event) => event.preventDefault());
  contents.on("will-navigate", (event, url) => {
    if (url !== initialURL) event.preventDefault();
  });
  contents.on("will-frame-navigate", (event) => {
    if (!event.url.startsWith("nexus-pkg://") && event.url !== initialURL)
      event.preventDefault();
  });
  contents.on("will-redirect", (event) => event.preventDefault());
}
export async function fileResponse(root, relative, csp, transform) {
  try {
    const file = await inside(root, relative);
    let body = await readFile(file);
    if (transform) body = transform(body.toString("utf8"));
    return new Response(body, {
      headers: {
        "Content-Type": MIME[path.extname(file)] || "application/octet-stream",
        "Content-Security-Policy": csp,
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Unavailable", { status: 404 });
  }
}
export function routePath(url) {
  const value = new URL(url);
  return decodeURIComponent(value.pathname.slice(1));
}
export function validSender(event, contents, url) {
  return (
    event.sender === contents &&
    event.senderFrame === contents.mainFrame &&
    event.senderFrame.url === url
  );
}
