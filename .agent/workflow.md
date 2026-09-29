# Workflow

## Before editing

1. verify exact remote `main` and baseline
2. read `AGENTS.md`, `.agent/start-here.md`, `.agent/status.md`
3. read the canonical technical doc for the subsystem
4. inspect matching source and tests
5. preserve sandbox, IPC, origin, capability, path, quota and integrity checks

## Setup and core validation

```sh
npm ci
npm run validate
npm run format:check
```

## Desktop/runtime validation

```sh
npm run test:desktop
npm start
```

Requires an appropriate desktop environment with Electron support. Do not treat root-container no-sandbox fixtures as production sandbox certification.

## Preview and packaging

```sh
npm run preview
npm run package
npm run package:linux
npm run package:windows
npm run package:mac
```

## Minimum evidence by change type

- docs → path/command/source/evidence audit + documentation-only diff
- manifest/contracts → contract tests + package-authoring review
- package acquisition → local/GitHub resolution, immutable cache, failure/cancel tests
- storage → origin/version/schema/concurrency/recovery tests
- network broker → URL/public-IP/redirect/type/size/payload tests; native relay separately when required
- IPC/security → sender/frame/generation/capability/security tests + desktop evidence
- ESM runtime → Worker lifecycle/persistence/restriction evidence
- Python runtime → real bundled Pyodide/wheel evidence
- Codex → fixture/policy tests; live authenticated run is a separate gate
- desktop interaction → native Electron plus human interaction/visual evidence
- package/installer → build on the target OS and install/launch evidence; unpacked output alone is insufficient

## Closeout

Review every changed path, race-check `main`, fast-forward with `force=false`, re-read every changed document from live GitHub, and record implementation findings in `.agent/feedback.md`.
