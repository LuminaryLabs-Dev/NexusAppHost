# Goal

NexusAppHost should provide a secure desktop host where versioned Luminary application packages can be inspected, permissioned, executed, persisted, stopped, upgraded and recovered without granting downloaded applications unrestricted operating-system authority.

## Success conditions

- verified source/package identity and immutable validated cache
- explicit narrow capability grants
- ESM and dependency-free pure-Python package support
- durable origin-bound storage across compatible updates
- deterministic stop/reload/recovery behavior
- bounded public-page access through `network.fetch`
- optional advisory Codex assessment without general shell authority
- package acquisition that never executes code during inspection
- clear diagnostics and recovery paths
- platform packaging with evidence separated from installer acceptance
- release claims that match actual OS/runtime/visual/integration evidence

## Explicit non-goals

- arbitrary shell or general subprocess access for hosted packages
- downloaded native dependencies or native Python wheels
- unrestricted package networking
- silent data migration or deletion
- private GitHub credentials in repository/source fields
- automatic lead approval by Codex
- treating Chromium isolation as perfect protection against arbitrary malicious code
