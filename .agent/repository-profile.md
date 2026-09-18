# NexusAppHost repository profile

## Identity

- Repository: `LuminaryLabs-Dev/NexusAppHost`
- Default branch: `main`
- Visibility: public
- Fork: no
- Archived: no
- License: MIT
- Primary language: JavaScript
- Package version: `1.0.0`
- Application ID: `dev.luminary.nexus-app-host`
- Repository purpose: local desktop hosting for versioned Luminary application packages
- Current documented source tree: `cf471125f1ef74f948dd6b5042d5ca3802fb9f29`

The repository contains the NexusAppHost source implementation. It does not contain Reboot Research Studio, NexusResearchEngine, or the 1,000-lead research dataset.

## Runtime and dependencies

The authoritative package configuration is `/package.json`.

- Node constraint: `>=24 <25`
- Electron: `44.3.0`
- Pyodide: `314.0.6`
- AJV: `8.20.0`
- JSZip: `3.10.1`
- Electron Builder: `26.15.3`
- Package entry: `/src/main/main.mjs`
- Module type: ESM
- Build output directory: `dist/`
- Supported packaging targets: Linux AppImage, Windows NSIS, macOS DMG

## Authoritative implementation paths

### Electron shell and renderer

- `/src/main/main.mjs` — privileged Electron main process and window setup.
- `/src/preload/bridge.cjs` — narrow preload bridge.
- `/src/preload/runtime.cjs` — runtime preload support.
- `/src/renderer/index.html` — host UI document.
- `/src/renderer/app.mjs` — host UI behavior.
- `/src/renderer/sdk.js` — hosted application SDK.
- `/src/renderer/styles.css` — host UI styling.

### Hosted runtimes

- `/src/runtimes/desktop.mjs` — desktop runtime session.
- `/src/runtimes/index.html` — hidden runtime renderer document.
- `/src/runtimes/runner.mjs` — runtime execution bridge.
- `/src/runtimes/worker.mjs` — Worker protocol and runtime boundary.
- `/src/runtimes/python-bootstrap.mjs` — Python entry and capability bootstrap.

### Services

- `/src/services/host.mjs` — package lifecycle, grants, runtime generation, and host calls.
- `/src/services/packages.mjs` — package detection, manifest validation, GitHub retrieval, snapshots, and wheel inspection.
- `/src/services/security.mjs` — URL, path, sender, capability, and content-security checks.
- `/src/services/storage.mjs` — origin-bound JSON data, cache, staging, atomic writes, and logs.
- `/src/services/contracts.mjs` — package and assessment contract validation.
- `/src/services/errors.mjs` — typed error definitions and messages.

### Optional Codex integration

- `/src/integrations/codex/index.mjs` — local CLI probing and restricted `codex.assess` adapter.

## Package and contract paths

- `/contracts/manifest.schema.json` — executable `nexus-app.json` schema.
- `/contracts/assessment.schema.json` — executable Codex assessment output schema.
- `/docs/package-authoring.md` — package authoring and runtime contract.
- `/examples/esm/nexus-app.json` — Field Notes package manifest.
- `/examples/python/nexus-app.json` — Signal Check package manifest.
- `/examples/python/signal_check-1.0.0-py3-none-any.whl` — bundled pure Python wheel example.

## Scripts and tests

- `/scripts/validate.mjs` — syntax, service, contract, Codex fixture, and Python validation.
- `/scripts/test-desktop.mjs` — native Electron integration runner.
- `/scripts/preview.mjs` — local renderer preview server.
- `/scripts/build-wheel.py` — reproducible example wheel builder.
- `/tests/core.test.mjs` — service, security, storage, package, IPC, and host tests.
- `/tests/python.test.mjs` — real bundled Pyodide and wheel test.
- `/tests/codex.test.mjs` — Codex adapter fixture and policy tests.
- `/tests/electron-suite.mjs` — native renderer, Worker, persistence, restriction, and recovery tests.

## Documentation and evidence paths

- `/README.md` — human setup and usage.
- `/AGENTS.md` — durable working rules.
- `/CHANGELOG.md` — public release history.
- `/docs/architecture.md` — runtime and trust-boundary authority.
- `/docs/codex.md` — optional Codex integration authority.
- `/docs/implementation-plan.md` — implementation history and design choices.
- `/docs/package-authoring.md` — package contract authority.
- `/docs/troubleshooting.md` — operational recovery.
- `/docs/ux.md` — user interface behavior.
- `/validation/acceptance.md` — validation status and release gates.
- `/validation/native-results.json` — machine-readable native test evidence.

## Documentation state

The repository previously had `README.md`, `AGENTS.md`, technical documentation, contracts, tests, and validation evidence, but no `.agent/` directory. This profile is part of the documentation-only foundation added to provide durable agent routing and continuity.
