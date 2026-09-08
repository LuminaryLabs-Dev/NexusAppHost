# Architecture and trust boundary

The privileged Electron main process owns package retrieval, identity, storage,
permissions, lifecycle and diagnostics. It never imports downloaded modules.
The host renderer uses a context-isolated preload with named operations. The
host validates the originating webContents, top-level frame, exact URL, operation
and payload before accepting IPC.

Hosted UI executes in a sandboxed, opaque-origin iframe with no Node integration.
Its injected SDK negotiates a MessageChannel with the host renderer. The relay
checks the frame, session generation, message size and concurrent request count.
App messages cannot invoke host management methods such as loading packages or
choosing local paths.

ESM and Python logic execute in a dedicated Worker in a separate hidden Electron
renderer/session. The Worker has no Node environment. The session permits only
the trusted runtime resources, the selected immutable package, and (for Python)
the bundled interpreter files. CSP and request interception prohibit external
network access; OS permission requests and downloads are denied. Webviews, new
windows, external navigation and redirects are blocked.

Python uses a WebAssembly interpreter with a disposable virtual filesystem,
not a native venv or host interpreter subprocess. Persistent data crosses the
same reviewed storage capability used by ESM. Native execution support is not
silently enabled on any platform.

## Storage layout

Under Electron's platform `userData` directory:

| Path                                   | Purpose                                                 |
| -------------------------------------- | ------------------------------------------------------- |
| `preferences.json`                     | Last selected source, never automatic execution consent |
| `staging/`                             | Incomplete inspections; recovered on startup            |
| `cache/<identity>/package/`            | Validated immutable package files                       |
| `cache/<identity>/record.json`         | Source, commit/fingerprint, per-file hashes             |
| `data/<origin-and-app-hash>/data.json` | Schema-versioned approved JSON data                     |
| `logs/diagnostics.json`                | Last 200 host-controlled diagnostic categories          |
| `environments/`                        | Reserved; Python environments are currently in memory   |

Writes use temporary files, fsync and atomic rename. Writes to the same app data
file are serialized. The host checks the package's cached content hashes again
before execution. Cache cleanup protects active code and retains saved data.
Deleting data requires a separate native confirmation and a stopped application.
Source preferences are restored after restart; packages are not automatically
executed or given remembered permissions.

## GitHub acquisition

The host uses public GitHub REST endpoints, resolves the selected branch/tag/ref
to a full commit and reads that commit's tree and blobs. It does not unpack a
repository archive or execute dependency scripts. Each response has a timeout
and size limit; cancellation removes staging files. All selected tree entries
must be ordinary files within the package directory. The complete snapshot is
promoted with one directory rename only after validation. Incomplete downloads
cannot replace an existing usable cache entry.

GitHub's public API rate limit can be reached when a package has many files.
V1 prioritizes explicit bounded retrieval over tokens or opaque authentication.
Use a small bundled package or a local folder when rate-limited.

## Limits of the boundary

Only use packages from trusted authors. The host is not an audited hostile-code
execution service. Chromium vulnerabilities and extreme memory allocation remain
risks. The native fixture tests here verified browser-level restrictions with
Chromium's OS sandbox disabled in a root container; those tests do not certify
the OS sandbox. Production refuses `--no-sandbox`, and sandbox-enabled native
testing is an outstanding release gate.

Codex is a trusted installed CLI outside the package runtime. Its optional
adapter passes only validated input and fixed arguments, not arbitrary commands.
It is separately described in `docs/codex.md`; it is not a general process API.

Reference: [Electron process sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox).
