# NexusAppHost durable memory

This file contains durable decisions and boundaries. It is not a task log.

## Product identity

- NexusAppHost is a desktop host for versioned Luminary application packages.
- It is not Reboot Research Studio.
- It is not NexusResearchEngine.
- It is not a lead database and does not contain the 1,000-lead research dataset.
- The public product version recorded in the repository is `1.0.0`.

## Runtime and security decisions

- Privileged host operations belong in the Electron main process.
- Downloaded application modules must not be imported or executed by the main process.
- Hosted applications use a narrow brokered capability API.
- ESM and Python application logic run in isolated Worker contexts.
- Hosted UI runs in a sandboxed opaque-origin frame.
- IPC must validate sender, frame, URL, operation, payload, generation, and capability.
- Security checks must not be weakened to make an example or test pass.
- External network, shell, Node built-ins, native files, and unrestricted OS operations are not available to hosted packages.
- Package contents are immutable after validation and are rechecked before execution.
- Stopped runtime generations lose access and late responses must not be accepted.

## Python decision

- Python is executed through bundled Pyodide, not a native interpreter subprocess or virtual environment.
- Accepted wheels are dependency-free `py3-none-any` wheels with pure-library metadata.
- Native extensions, `.pth` hooks, external dependencies, package-index downloads, and OS processes are unsupported.
- Compatible Python source dependencies must be vendored into the authored wheel.

## Package acquisition decisions

- Public GitHub acquisition is intentionally unauthenticated.
- Private repositories are loaded through a separately cloned local folder.
- GitHub references are resolved to a full commit before tree and blob retrieval.
- Repository archives are not used for package acquisition.
- Paths, symlinks, traversal, encoded paths, unsupported entries, file counts, sizes, and package limits are validated before promotion.
- Package inspection does not execute package code.

## Persistence decisions

- Storage identity includes the verified source origin and application ID.
- Package version and Git commit are excluded from the storage identity so compatible upgrades retain data.
- Different origins cannot claim the same data by copying an application ID.
- A changed data schema blocks access rather than silently migrating or deleting data.
- V1 has no automatic migration or cross-origin import.
- Cache cleanup must preserve active code and saved data.
- Writes use temporary files, synchronization, atomic rename, and serialized access.

## Codex decisions

- Codex is an optional local CLI adapter, not a general process or shell API.
- The adapter accepts fixed assessment input and returns structured suggestions.
- It never approves leads.
- Invented evidence IDs, unknown fields, malformed JSON, tool events, failed turns, inherited MCP integrations, unsafe hooks, and unsupported configuration are rejected.
- Execution must remain shell-free, read-only, ephemeral, bounded, cancellable, and time-limited.
- Live authenticated Codex behavior remains an open validation gate.

## Validation decisions

- Fixture validation is not OS sandbox certification.
- Runtime validation is not device validation.
- Build validation is not installer or deployment validation.
- Static validation is not visual or interaction validation.
- A successful source build does not prove Windows or macOS distribution.
- Claims must remain within the evidence recorded in `/validation/acceptance.md` and `/validation/native-results.json`.
