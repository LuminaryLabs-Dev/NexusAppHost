# NexusAppHost agent start here

## Repository

This repository is `LuminaryLabs-Dev/NexusAppHost`. It is a public Electron desktop host for versioned Luminary application packages. It is not Reboot Research Studio, NexusResearchEngine, or a lead database.

## Read in this order

1. Read `/AGENTS.md`. These are the repository's working rules and security boundaries.
2. Read `/README.md`. This is the human installation and usage guide.
3. Read `.agent/repository-profile.md`. It identifies the repository structure and authoritative implementation files.
4. Read `.agent/status.md`. It records the current validated state and open gates.
5. Read `.agent/memory.md` when working on architecture, security, storage, package loading, or Codex.
6. Read the relevant technical authority:
   - `/docs/architecture.md` for process, Worker, IPC, package, storage, and trust boundaries.
   - `/docs/package-authoring.md` for the `nexus-app.json` package contract and runtime limits.
   - `/docs/codex.md` for the optional local Codex assessment adapter.
   - `/docs/ux.md` for the host interface and interaction contract.
   - `/docs/troubleshooting.md` for known recovery paths.
7. Read `/validation/acceptance.md` before making any completion, release, or platform-validation claim.
8. Inspect the relevant source and tests before proposing a change.

## Common commands

Use Node.js 24 LTS and npm 11.

```sh
npm ci
npm run validate
npm run test:desktop
npm run format:check
npm run preview
npm start
```

Run `npm ci` only when a local runtime environment is needed. Run `npm run validate` after implementation changes. Run `npm run test:desktop` only in an appropriate desktop environment with Electron support.

## Working boundaries

- Keep hosted application code outside the Electron main process.
- Do not weaken sandbox, CSP, IPC sender, capability, origin, path, quota, or integrity checks.
- Do not add workflows, branches, pull requests, credentials, deployment behavior, or unrelated cleanup without explicit authorization.
- Do not treat fixture tests as proof of OS sandbox certification, visual completion, installer acceptance, or live Codex authentication.
- Preserve `LICENSE`.
- Keep personal data, authentication material, caches, `node_modules`, and installers out of Git.

## Continuity

Use `.agent/status.md` for current state and one next action. Use `.agent/memory.md` for durable architectural decisions. Use `.agent/change-log.md` for documentation and maintenance events. Use `/CHANGELOG.md` for public release history.
