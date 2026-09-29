# NexusAppHost durable memory

This file contains durable decisions and boundaries. It is not a task log.

## Product identity

- NexusAppHost is a desktop host for versioned Luminary application packages.
- It is not Reboot Research Studio, NexusResearchEngine, or a lead database.
- Current product/package version: `1.1.0`.

## Runtime and security decisions

- Privileged host operations belong in the Electron main process.
- Downloaded application modules must not be imported or executed by the main process.
- Hosted applications use a narrow brokered capability API.
- ESM and Python application logic run in isolated Worker contexts.
- Hosted UI runs in a sandboxed opaque-origin frame.
- IPC validates sender, frame, URL, operation, payload, runtime generation and capability.
- Security checks must not be weakened to make an example or test pass.
- Direct external network, shell, Node built-ins, native files and unrestricted OS operations are unavailable to hosted packages.
- Package contents are immutable after validation and rechecked before execution.
- Stopped runtime generations lose capability access; late responses must not be accepted.

## Public-page broker decisions

`network.fetch` is the only general web-fetch exception:
- explicit capability grant required
- payload contains only `url`
- public HTTP/S only on standard ports
- embedded credentials rejected
- IPv6 rejected in V0
- DNS/public target pinned to validated IPv4
- private/reserved IPv4 rejected
- each redirect is revalidated
- maximum 5 redirects
- 15-second timeout
- 180,000-byte body limit
- readable HTML/XHTML/plain text only

Node policy tests cover these rules. Native Electron relay validation remains a separate evidence gate.

## Python decision

- Python executes through bundled Pyodide, not a native interpreter subprocess/venv.
- Accepted wheels are dependency-free `py3-none-any` pure wheels.
- Native extensions, `.pth` hooks, external dependencies, index downloads and OS processes are unsupported.
- Compatible pure-Python dependencies must be vendored into the authored wheel.

## Package acquisition decisions

- Public GitHub acquisition is intentionally unauthenticated.
- Private repositories are loaded from separately cloned local folders.
- GitHub references resolve to a full commit before tree/blob retrieval.
- Repository archives are not used for acquisition.
- Paths, symlinks/submodules, file counts and sizes are validated before promotion.
- Package inspection does not execute package code.

## Persistence decisions

- Storage identity includes verified source origin and application ID.
- Package version and Git commit are excluded so compatible upgrades retain data.
- Different origins cannot claim the same data by copying an app ID.
- Changed data schema blocks access rather than silently migrating/deleting data.
- V1 has no automatic migration or cross-origin import.
- Cache cleanup preserves active code and saved data.
- Writes use staging/temporary files, synchronization and atomic replacement.

## Codex decisions

- Codex is an optional local CLI adapter, not a general shell/process API.
- It accepts fixed assessment input and returns structured suggestions.
- It never approves leads.
- Invented evidence IDs, unknown fields, malformed JSON, unsafe tool/config behavior and failed turns are rejected.
- Execution remains shell-free, read-only, ephemeral, bounded, cancellable and time-limited.
- Live authenticated Codex remains an open validation gate.

## Validation decisions

- Fixture validation ≠ OS sandbox certification.
- Runtime validation ≠ device or visual validation.
- Build validation ≠ installer/distribution validation.
- Static policy tests ≠ native Electron relay proof.
- Codex fixtures ≠ live authenticated Codex.
- Claims must remain within `validation/acceptance.md` and `validation/native-results.json`.
