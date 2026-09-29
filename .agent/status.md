# NexusAppHost current status

Status date: 2026-09-29  
Repository: `LuminaryLabs-Dev/NexusAppHost`  
Branch: `main`  
Upkeep: `MNT-368`

## Current validated state

- NexusAppHost `1.1.0` source exists on `main`.
- Repository is public and MIT licensed.
- ESM Field Notes and pure-Python Signal Check examples are included.
- Source/service/contract/Python/storage/security/Codex fixture validation exists.
- Native Electron fixture evidence records Electron `44.3.0`, Chrome `152.0.7977.78`, Node `24.20.0`, and Chromium OS sandbox tested = `false`.
- Linux unpacked packaging has been produced.
- The 1.1 public-page broker has focused Node policy tests for URL, public IPv4, redirects, content type, size and payload smuggling.
- Current documentation audit baseline is `e6f3815d834499ee57f7b1284a08c9f176412f12`.

## Current limitations and open gates

- No GitHub Actions workflow is present in the audited repository tree.
- No signed installer release is recorded.
- Windows and macOS installers are not recorded as built/installed/tested in acceptance evidence.
- Chromium OS sandbox certification is incomplete because recorded container-native tests used a no-sandbox fixture path.
- Visual/interaction acceptance remains blocked/unverified; no screenshot/visual-completion claim is supported.
- Live authenticated Codex execution remains unverified; fixture/process policy tests are lower-tier evidence.
- Native Electron relay validation for the 1.1 `network.fetch` path was not rerun in the recorded broker update.
- Linux unpacked output is build evidence, not installed-distribution acceptance.

## Runtime facts

- Public GitHub package references resolve to a full commit before package tree/blob retrieval.
- Package inspection validates bounded regular files and does not execute downloaded code.
- Hosted logic runs in Worker contexts; hosted UI is isolated from main-process authority.
- Storage identity is verified source origin + application ID; package version and Git revision do not change saved-data identity.
- Data schema mismatch blocks access; V1 performs no silent migration.
- Python accepts dependency-free pure `py3-none-any` wheels; native extensions, `.pth`, external dependencies and OS subprocesses are unsupported.
- `network.fetch` is URL-only, public HTTP/S-only, IPv4-pinned, 180,000-byte, 15-second and 5-redirect bounded.
- Codex assessment is advisory and never approves leads.

## Documentation state

- Root human/technical docs: present.
- `AGENTS.md`: present.
- `.agent/` standardized continuity set: completed by MNT-368.
- Upkeep entry: registered as MNT-368.
- Product/runtime behavior: unchanged by this documentation pass.

## Next justified action

No documentation follow-up after MNT-368 if Audit 3 is clean. Runtime, packaging, OS-sandbox, visual, live-Codex, deployment or product work requires a separate bounded authorization.
