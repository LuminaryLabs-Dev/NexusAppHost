# Feedback and deferred findings

These findings are outside the documentation-only MNT-368 pass.

## NAH-001 — Chromium OS sandbox is not certified by recorded native evidence

- Evidence: `validation/native-results.json`, `validation/acceptance.md`
- Observation: `chromiumSandboxTested` is false and recorded root-container tests used a no-sandbox fixture path.
- Status: blocked pending regular-user/platform evidence

## NAH-002 — Visual and interaction acceptance remains unverified

- Evidence: `validation/acceptance.md`
- Observation: the exact preview was served, but browser access policy blocked visual walkthrough evidence.
- Status: blocked pending visual/manual review

## NAH-003 — Live authenticated Codex remains unverified

- Evidence: `validation/acceptance.md`, `.agent/memory.md`
- Observation: fixture/process policy tests exist; live authenticated CLI behavior was unavailable.
- Status: blocked pending authenticated environment

## NAH-004 — Windows/macOS installer acceptance remains open

- Evidence: README and acceptance record
- Observation: build scripts/targets exist, but recorded evidence does not include built/installed/tested Windows or macOS installers.
- Status: platform gate

## NAH-005 — Native Electron relay evidence for network.fetch was not rerun in the 1.1 broker update

- Evidence: `validation/acceptance.md`, `.agent/change-log.md`
- Observation: focused Node broker policy tests pass; native Electron relay remains a separate unrerun gate.
- Status: recommended later

## NAH-006 — No GitHub Actions workflow is present in the audited 63-file tree

- Evidence: audited repository tree
- Observation: CI/release automation is not currently part of this repository baseline.
- Status: informational; add only under separate authorization
