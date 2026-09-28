# Changelog

## 1.1.0 — 2026-09-28

Added the capability-gated `network.fetch` public-page broker for small trusted
application packages such as Reboot Research Studio V0.1. The broker is URL-only,
pins public IPv4 DNS results, revalidates redirects, blocks private/reserved
targets, credentials, IPv6 and nonstandard ports, and enforces redirect, time,
content-type and response-size limits. Hosted applications still have no direct
network or socket access.

## 1.0.0 — 2026-09-08

Initial source implementation: Electron host, public GitHub/local package
inspection, immutable snapshots, capability review, ESM/Python workers,
origin-bound persistence, stop/reload, bounded diagnostics, examples, packaging
commands and an optional Codex assessment adapter.

Python uses bundled Pyodide rather than native interpreter subprocesses. Only
dependency-free `py3-none-any` wheels are supported. Full platform and live Codex
validation remain release gates; see `validation/acceptance.md`.
