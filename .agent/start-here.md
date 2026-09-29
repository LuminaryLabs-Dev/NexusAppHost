# NexusAppHost agent start here

## Repository

This repository is `LuminaryLabs-Dev/NexusAppHost`, a public Electron desktop host for versioned Luminary application packages. It is not Reboot Research Studio, NexusResearchEngine, or a lead database.

## Current audit snapshot

- Default branch: `main`
- Documentation baseline: `e6f3815d834499ee57f7b1284a08c9f176412f12`
- Package: `nexus-app-host@1.1.0`
- Node: `>=24 <25`
- Electron: `44.3.0`
- Pyodide: `314.0.6`
- Upkeep pass: `MNT-368`

## Read in this order

1. `/AGENTS.md` — repository security and working rules.
2. `/README.md` — human setup and usage.
3. `.agent/repository-profile.md` — factual inventory and implementation map.
4. `.agent/status.md` — current validated state and open gates.
5. `.agent/goal.md` and `.agent/intention.md` — enduring outcome and design rationale.
6. `.agent/memory.md` — durable architectural/security decisions.
7. `.agent/workflow.md` — change-to-validation mapping.
8. Relevant canonical docs under `/docs/`.
9. `/validation/acceptance.md` before any completion, platform, release, or integration claim.
10. Relevant source and tests before proposing or making a change.

## Runtime map

```text
package source
  ↓ inspect + validate + pin
immutable package cache
  ↓ explicit grants
sandboxed hosted UI + Worker runtime
  ↓ narrow capability broker
Electron main-process services
```

ESM runs as browser-compatible modules in a Worker. Python runs through bundled Pyodide with dependency-free pure wheels. Hosted packages do not receive Node, shell, native-file, unrestricted network, or arbitrary OS capabilities.

## Storage and identity

Persistent JSON data is keyed by verified source origin plus application ID. Compatible package-version or Git-commit changes retain data; origin changes do not. Data-schema mismatches stop loading rather than silently migrating or deleting data.

## Public-page broker

`network.fetch` is the only general web-fetch exception. It accepts only a URL, permits public HTTP/S on standard ports, rejects credentials and IPv6, pins public IPv4 resolution, allows at most 5 redirects, times out at 15 seconds, and caps readable response bodies at 180,000 bytes.

## Codex boundary

`codex.assess` is an optional local CLI adapter for bounded structured suggestions. It never approves leads and does not provide a general shell/process capability.

## Common commands

```sh
npm ci
npm run validate
npm run test:desktop
npm run format:check
npm run preview
npm start
npm run package
```

Use `npm run test:desktop` only in a real desktop environment. Packaging, installer, visual, OS-sandbox and live-Codex claims require their own evidence tiers.

## Continuity

Use `.agent/status.md` for current state, `.agent/memory.md` for durable decisions, `.agent/feedback.md` for deferred findings, `.agent/change-log.md` for documentation/maintenance history, and root `CHANGELOG.md` for public release history.
