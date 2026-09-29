# Intention

## Treat packages as untrusted application payloads

The host may load code from public GitHub or local folders, so package inspection, immutable caching, explicit grants and process boundaries exist to reduce authority before execution.

## Keep privileged authority in a small host boundary

Retrieval, storage, permissions, lifecycle, diagnostics and brokered capabilities belong to the privileged host. Downloaded application modules do not run in Electron main.

## Separate app logic from host authority

ESM and Python logic execute in Worker contexts behind a narrow message/capability protocol. Hosted UI is separately sandboxed.

## Make permissions explicit

Storage, network and Codex access are capabilities rather than ambient rights. Ungranted operations fail closed.

## Bind persistence to source identity

Source origin + application ID owns saved data. Compatible version updates retain data without allowing unrelated origins to claim it.

## Use bundled Pyodide instead of host Python

Pure wheels keep Python portable and bounded without invoking system interpreters, installers or source builds.

## Broker web access instead of enabling general network

`network.fetch` intentionally exposes one bounded public-page operation rather than arbitrary sockets/headers/credentials.

## Keep Codex advisory

The optional adapter is a fixed structured assessment path and never an approval or general agent-execution surface.

## Keep evidence tiers separate

Fixtures, native Electron tests, visual review, OS sandbox certification, installers and live Codex each prove different things.
