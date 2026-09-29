# NexusAppHost repository profile

## Identity

- Repository: `LuminaryLabs-Dev/NexusAppHost`
- Default branch: `main`
- Visibility: public
- License: MIT
- Package version: `1.1.0`
- Application ID: `dev.luminary.nexus-app-host`
- Audit baseline commit: `e6f3815d834499ee57f7b1284a08c9f176412f12`
- Audit baseline tree: `32100e711a4ec55b01e1535ca2128737b91b76a9`
- Audited files: 63

## Runtime and dependencies

- Node: `>=24 <25`
- Electron: `44.3.0`
- Pyodide: `314.0.6`
- AJV: `8.20.0`
- JSZip: `3.10.1`
- Electron Builder: `26.15.3`
- Module type: ESM
- Package entry: `src/main/main.mjs`
- Build output: `dist/`
- Packaging targets: Linux AppImage, Windows NSIS, macOS DMG

## Authoritative implementation paths

### Electron shell and renderer

- `src/main/main.mjs` — privileged Electron main process and window setup.
- `src/preload/bridge.cjs` — narrow host preload bridge.
- `src/preload/runtime.cjs` — runtime preload support.
- `src/renderer/app.mjs` — host UI behavior.
- `src/renderer/sdk.js` — hosted application SDK.

### Hosted runtimes

- `src/runtimes/desktop.mjs` — runtime session lifecycle.
- `src/runtimes/runner.mjs` — runtime execution bridge.
- `src/runtimes/worker.mjs` — Worker protocol/runtime boundary.
- `src/runtimes/python-bootstrap.mjs` — Pyodide Python bootstrap.

### Services

- `src/services/host.mjs` — lifecycle, grants, runtime generations and host calls.
- `src/services/packages.mjs` — local/GitHub acquisition, full-commit resolution, snapshotting, manifest validation and pure-wheel inspection.
- `src/services/network.mjs` — capability-gated public page broker.
- `src/services/security.mjs` — URL/content/session/CSP/sender restrictions.
- `src/services/storage.mjs` — origin-bound saved data, cache, staging, atomic writes and logs.
- `src/services/contracts.mjs` — package and assessment validation.
- `src/integrations/codex/index.mjs` — restricted local Codex adapter.

## Package and contract authorities

- `contracts/manifest.schema.json` — `nexus-app.json` schema.
- `contracts/assessment.schema.json` — Codex assessment output schema.
- `docs/package-authoring.md` — package/runtime contract.
- `examples/esm/` — Field Notes ESM example.
- `examples/python/` — Signal Check pure-Python/Pyodide example.

## Public page broker facts

- payload: URL only
- protocols: HTTP/HTTPS only
- ports: standard 80/443 only
- embedded credentials: rejected
- IPv6: unsupported/rejected
- DNS: public IPv4 only; private/reserved ranges rejected
- redirect maximum: 5
- timeout: 15,000 ms
- response maximum: 180,000 bytes
- content: readable HTML/XHTML/plain text
- redirect targets are revalidated under the same policy

## Scripts and tests

- `scripts/validate.mjs` — repository validation route.
- `scripts/test-desktop.mjs` — native Electron integration runner.
- `scripts/preview.mjs` — renderer preview server.
- `scripts/build-wheel.py` — reproducible example wheel builder.
- `tests/core.test.mjs` — core host/security/storage/package tests.
- `tests/network.test.mjs` — public-page URL, public-IP, redirect, type, size and payload tests.
- `tests/python.test.mjs` — bundled Pyodide/wheel behavior.
- `tests/codex.test.mjs` — Codex adapter policy fixtures.
- `tests/electron-suite.mjs` — native renderer/Worker/persistence/recovery assertions.

## Documentation and evidence

- `README.md` — human entry point.
- `AGENTS.md` — working/security rules.
- `docs/architecture.md` — trust/runtime authority.
- `docs/package-authoring.md` — authoring contract.
- `docs/codex.md` — Codex integration.
- `docs/ux.md` — UX behavior.
- `docs/troubleshooting.md` — recovery.
- `validation/acceptance.md` — evidence and open gates.
- `validation/native-results.json` — recorded Electron/Chromium/Node/V8 runtime assertions.

## Documentation state

The repository already had a partial `.agent/` continuity package. MNT-368 reconciles that package to the 1.1.0 broker baseline and completes it with goal, intention, workflow and feedback documents. Canonical human/technical docs remain authoritative.
