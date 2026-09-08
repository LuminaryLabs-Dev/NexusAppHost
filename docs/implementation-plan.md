# Implementation milestones

Baseline: `59e88262b6eef9d75045c045a9c76a6278f41892`, originally README and MIT
LICENSE only. Scope is `LuminaryLabs-Dev/NexusAppHost`; Studio and engine are not
modified. Work was implemented in the supplied sandbox.

| Milestone             | Implemented outcome                                                                      | Validation/status                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1. Desktop foundation | Electron main, preloads, renderer, pinned dependencies, commands                         | Linux bundle builds; native fixture launch passes                                   |
| 2. Package contract   | Executable manifest and wire validation                                                  | Positive and negative contract tests pass                                           |
| 3. Acquisition        | Public GitHub SHA resolution and bounded blobs; local snapshots                          | Fixture branch/tag/SHA, cancellation, symlink and cache checks pass                 |
| 4. Storage/boundaries | Origin-bound data, atomic writes, narrow IPC, reviewed grants                            | Concurrency, impersonation, revocation and quotas tested                            |
| 5. ESM                | Separate renderer Worker, lifecycle, requests, deadlines, recovery                       | Native activation, storage, denied operations and infinite-loop recovery pass       |
| 6. Python             | Bundled Pyodide; validated pure wheels in disposable virtual environments                | Real interpreter and native Worker example pass                                     |
| 7. UX                 | Corner panel, review, manage, cancel, errors, keyboard and reduced-motion implementation | Native SDK transport tested; visual/interaction review blocked by browser policy    |
| 8. Codex              | Fixed assessment contract, CLI probing, restricted adapter and cancellation              | Fixture outputs and process failures pass; authenticated live execution unavailable |
| 9. Reliability        | Staging cleanup, immutable cache, serialized writes, schema checks, logs                 | Automated checks pass; native persistence after stop/reload passes                  |
| 10. Packaging         | Examples, reproducible wheel, Linux/Windows/macOS build commands                         | Linux unpacked bundle builds; native installer acceptance still open                |
| 11. Publication       | One complete source commit, unchanged license, no workflows                              | Record final commit/readback in the delivery message                                |

## Deliberate implementation choices

Python is **WebAssembly CPython via Pyodide**, replacing the draft native
subprocess/venv design. This removes host-interpreter provisioning and native
wheel installation, gives ESM and Python the same browser boundary, and narrows
Python compatibility. There are no native Python runtime claims.

Public GitHub package files are fetched from the pinned Git tree/blob API rather
than extracting repository archives. This eliminates archive extraction from
source retrieval and keeps path validation explicit, at the cost of API calls.

V1 refuses incompatible data schemas rather than implementing speculative data
migrations. It saves the source preference but requires a new review/load after
restart. Source code and installer validation are reported separately.

## Remaining concrete release gates

1. Run the desktop suite as a regular user with Chromium's OS sandbox enabled.
2. Complete visual, keyboard, narrow-screen and screen-reader walkthroughs using
   the exact renderer; capture the requested states and interaction recording.
   The session's browser service explicitly blocked local URLs.
3. Build, install and launch on the target Windows/macOS machines (and install
   the Linux distribution on a normal desktop). Signing is not configured.
4. Validate the exact installed Codex version and effective tool restrictions
   with authenticated harmless sample evidence before enabling production use.

These are validation gates, not fabricated successes. Native tests in the root
sandbox verify application behavior with controlled fixtures but do not certify
Chromium's OS sandbox.
