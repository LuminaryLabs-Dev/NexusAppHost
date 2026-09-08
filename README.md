# NexusAppHost

A desktop home for versioned Luminary applications. Inspect a public GitHub or
local package, review its requested access, load its interface, and keep its data
across restarts and version changes.

**This is the host V1 source implementation.** Reboot Research Studio and
NexusResearchEngine remain separate applications; this repository does not claim
to contain either product or 1,000 qualified leads. See the observed results and
remaining release gates in [validation/acceptance.md](validation/acceptance.md).

## Start locally

Use **Node.js 24 LTS** and npm 11 on a desktop account with a working display.

```sh
git clone https://github.com/LuminaryLabs-Dev/NexusAppHost.git
cd NexusAppHost
npm ci
npm start
```

If your npm configuration disables dependency install scripts, Electron's binary
may be missing. Run `node node_modules/electron/install.js` once, then retry.
Nexus itself never runs install scripts from downloaded application packages.
Run the application as a regular desktop user with Chromium sandboxing available.
Do not use `--no-sandbox` for actual applications.

## First useful result

1. Choose **Field Notes** on the welcome screen.
2. Inspect the package identity, local source and revision. Leave saved-data
   access selected; Codex access is optional and off by default.
3. Select **Approve and load**, enter a note, and save it.
4. Open **Applications** in the corner. Stop, inspect a reload, and load again.
   The note remains. Closing the panel leaves the app running.
5. Try **Signal Check** to exercise a pure-Python wheel. Its simple keyword
   checks are clearly labeled as an offline example requiring human review.

For GitHub, enter `LuminaryLabs-Dev/NexusAppHost` and choose manifest path
`examples/esm/nexus-app.json` or `examples/python/nexus-app.json`. Leave the
reference blank for the default branch, or use a branch, tag or full commit.
Inspection pins one complete commit before fetching any package files. GitHub
access is public-only; private repositories can be cloned separately and loaded
with **Local folder**. Do not enter access tokens in repository fields.

## Runtime and access contract

- **ESM:** bundled browser-compatible modules run in a dedicated Worker inside a
  separate Electron renderer. Node imports, native files and external network
  access are unavailable. Use the brokered API for approved operations.
- **Python:** a bundled Pyodide interpreter runs pure Python in the same Worker
  boundary. Each activation installs validated wheel files into a fresh virtual
  filesystem. Native wheels, subprocesses, source builds, `.pth` hooks and
  dynamically installed dependencies are unsupported.
- **Storage:** JSON keys belong to the pair of verified source origin and app ID.
  Version updates retain data. Moving a local folder creates a different source.
  Data-schema mismatches stop loading; V1 never silently migrates or deletes data.
- **Codex:** optional `codex.assess` accepts a fixed assessment schema and supplied
  evidence. It returns suggestions, never approved leads. Requires a compatible,
  authenticated **local Codex CLI** with a clean configuration. See
  [Codex setup and limits](docs/codex.md).

Load packages from authors you trust. Chromium isolation, narrow IPC and quotas
reduce exposure; they are not a claim that arbitrary malicious code cannot
exploit a browser vulnerability or exhaust memory.

## Development and packaging

```sh
npm run validate       # syntax, service, contract and actual Python tests
npm run test:desktop   # native Electron runtime integration; needs a desktop display
npm run format:check
npm run preview        # exact renderer at localhost:4173, without desktop operations
npm run package        # unpacked application for this platform
```

Installer commands: `npm run package:linux`, `npm run package:windows`, and
`npm run package:mac`. Build and launch on each target operating system before
distributing its installer. No signing credentials, auto-updater, workflow,
release upload or install-time Python download is included. The Linux unpacked
bundle was built here; Windows/macOS installers have not been validated.

Examples and their wheel are included. To reproduce the wheel after modifying
its Python source, run `npm run examples` using Python 3.12+ (on Windows, run
`py scripts/build-wheel.py` if `python3` is unavailable). Normal users need no
system Python installation.

## Documentation

- [Package authoring and message contract](docs/package-authoring.md)
- [Architecture and trust boundary](docs/architecture.md)
- [Corner-panel interaction](docs/ux.md)
- [Codex setup and limits](docs/codex.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Implementation milestones](docs/implementation-plan.md)
- [Acceptance results and open gates](validation/acceptance.md)

MIT license; the repository's original license is preserved.
