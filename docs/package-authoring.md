# Package authoring — Host API 1

Place a `nexus-app.json` beside a bundled runtime and static UI. Inspecting a
package does not execute its code. JSON schema is executable in
`contracts/manifest.schema.json`; unknown fields and capabilities are rejected.

```json
{
  "schemaVersion": 1,
  "id": "dev.example.research",
  "name": "Research Studio",
  "version": "1.0.0",
  "hostApi": 1,
  "runtime": { "kind": "esm", "entry": "runtime.mjs" },
  "ui": "index.html",
  "capabilities": ["storage"],
  "dataSchemaVersion": 1
}
```

All file paths are relative to the manifest's directory. Use forward slashes.
Absolute paths, traversal, symlinks, submodules and encoded paths are rejected.
Dotfiles, `.git`, `node_modules`, virtual environments and Python bytecode caches
are excluded. Bundle dependencies into the authored module; there is no npm
installation or Node runtime inside packages.

## ESM runtime

```js
let host;
export function activate(api) {
  host = api;
}
export async function request(method, payload) {
  if (method === "save") return host.storage.set("draft", payload);
  if (method === "read") return host.storage.get("draft");
  throw new Error("Unknown method");
}
export function stop() {
  /* best effort cleanup; persist before this */
}
```

`activate` and `stop` are optional; `request` is required. Modules may import
relative files from their own immutable package. No bare npm imports, Node
builtins, native filesystem, shell or external fetch. A stopped worker is
destroyed; never rely on asynchronous `stop` completing to save data.

## UI SDK

The host injects `window.nexus` into the HTML entry before application scripts.
The UI runs in an opaque-origin sandboxed frame. Include JS/CSS/image resources
in the package. External assets, forms, nested frames, workers, new windows and
top-level navigation are denied.

```js
await nexus.ready;
const result = await nexus.request("read", null);
await nexus.storage.set("selected-tab", "companies");
const saved = await nexus.storage.get("selected-tab");
```

Runtime API: `api.storage.get(key)`, `api.storage.set(key, value)`,
`api.progress(text)`, `api.assess(input)`. UI API: `nexus.request(method, data)`,
`nexus.storage.get/set`, `nexus.assess(input)`. Capability errors reject promises
with a readable message. Missing storage values return `null`.

## Python wheel

Use `runtime: {"kind":"python-wheel", "entry":"module:function",
"wheels":["example-1.0.0-py3-none-any.whl"]}`. The callable accepts
`(method, payload)` and returns JSON-compatible data; sync and async functions
are supported. Optional `activate(api)` receives async `api.get(key)` and
`api.set(key, value)`, and synchronous `api.progress(text)`.

The pinned Pyodide npm distribution includes the interpreter, WASM and standard
library. No interpreter download occurs at activation. Each Worker creates a
fresh virtual `/app`, installs validated wheel files, and imports the entry.
Use `py3-none-any` with `Root-Is-Purelib: true`. Wheels with `Requires-Dist`,
native binaries, `.pth`, `.data` installation schemes, path escapes, conflicting
files or symlinks fail. V1 accepts dependency-free wheels; vendor compatible
Python source dependencies into your own wheel. No package-index downloads.

This deliberately replaces the draft native-Python/venv proposal. It provides
a cross-platform browser execution boundary at the cost of native Python
extensions, OS processes and unrestricted networking. Research crawling belongs
in the separate engine/operator workflow until a specific brokered network
capability is designed; the host currently offers none.

## Wire protocol

Every runtime packet is `{v:1, id, op, payload}`. IDs are bounded strings;
requests correlate by UUID. Main→Worker operations: `activate`, `request`,
`capability-result`, `ping`, `stop`. Worker→main operations: `ready`, `result`,
`progress`, `error`, `capability`, `pong`. Unknown fields, versions, operations
and oversized packets fail. Capability responses contain `{value}` or
`{error:{code,message}}`. Runtime generation IDs are host-owned; late responses
from stopped generations are ignored and their permissions are revoked.

Limits: 512 source files; 8 MiB per source file; 64 MiB package; 8 MiB extracted
per wheel and 16 MiB across wheels; 256 KiB wire packet; 32 outstanding runtime
or capability requests; 64 KiB per storage value; 256 keys and 4 MiB total
stored JSON; 60-second startup; 130-second request timeout; approximately
10–12 seconds without Worker heartbeat before termination. There is no hard
per-process memory ceiling; malicious allocation remains a browser-process risk.

## Identity and upgrades

Data identity is SHA-256 of source origin plus manifest app ID. GitHub origin
contains normalized repository and package directory; local origin contains the
canonical absolute package directory. Package version and commit are excluded
from the data identity. Different origins cannot claim the same data by copying
an app ID. Changing `dataSchemaVersion` blocks access to incompatible saved
data. V1 has no automatic migration or import between origins.
