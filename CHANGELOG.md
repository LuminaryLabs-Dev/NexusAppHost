# Changelog

## 1.0.0 — 2026-09-08

Initial source implementation: Electron host, public GitHub/local package
inspection, immutable snapshots, capability review, ESM/Python workers,
origin-bound persistence, stop/reload, bounded diagnostics, examples, packaging
commands and an optional Codex assessment adapter.

Python uses bundled Pyodide rather than native interpreter subprocesses. Only
dependency-free `py3-none-any` wheels are supported. Full platform and live Codex
validation remain release gates; see `validation/acceptance.md`.
