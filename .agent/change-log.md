# NexusAppHost agent documentation change log

This file records agent-documentation and maintenance changes. Public release history remains in `/CHANGELOG.md`.

## 2026-09-18 — Add agent documentation foundation

- Repository: `LuminaryLabs-Dev/NexusAppHost`
- Branch: `main`
- Baseline tree inspected: `cf471125f1ef74f948dd6b5042d5ca3802fb9f29`
- Existing README, AGENTS rules, technical documentation, contracts, tests, and validation records reviewed.
- Missing `.agent/` directory confirmed before this documentation pass.
- Added:
  - `.agent/start-here.md`
  - `.agent/repository-profile.md`
  - `.agent/status.md`
  - `.agent/memory.md`
  - `.agent/change-log.md`
- No application source, runtime, package contract, test, configuration, or deployment behavior was changed.
- Required verification:
  - Re-read all five files from the resulting `main` commit.
  - Run `npm run validate` when a local checkout is available.
  - Confirm the diff contains only the five new `.agent/` files.
  - Keep Google Drive and the Luminary Upkeep sheet unchanged for this pass.

## Future entry format

### YYYY-MM-DD — Short change description

- Commit:
- Files changed:
- Reason:
- Validation performed:
- Remaining limitations:

## 2026-09-28 — Add bounded public-page broker

- Added the `network.fetch` manifest capability and Worker API.
- Added a main-process public HTTP(S) page broker with private-network, port,
  credential, redirect, timeout, content-type and response-size restrictions.
- Added focused broker tests and manifest coverage.
- Updated package-authoring, architecture, README, acceptance and durable agent
  documentation.
- Sandbox evidence: the isolated broker test suite passed 7/7 under Node 22.16.
- Full repository `npm run validate` and native Electron relay validation still
  require the repository's Node 24/Electron environment.
