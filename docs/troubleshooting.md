# Troubleshooting

| Symptom                          | Recovery                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Electron binary missing          | Run `node node_modules/electron/install.js`; ensure npm install scripts/downloads are allowed for trusted host dependencies.               |
| Display or sandbox startup error | Run on a regular desktop user account with Chromium sandbox support. Do not turn it off to run real packages.                              |
| Repository not found             | Check owner/repository and ref. Private repos are not supported; select a separately cloned local folder.                                  |
| Rate limit                       | Retry after GitHub's limit resets or use a local package. Avoid shipping hundreds of tiny files.                                           |
| Invalid manifest/path            | Follow the executable schema. UI and runtime paths are relative to the manifest directory. Remove symlinks and unsupported entries.        |
| Python wheel rejected            | Use dependency-free `py3-none-any`, purelib metadata, no native libraries or `.pth` hooks. Rebuild with `npm run examples` for the sample. |
| Unsupported import/network       | Bundle browser ESM dependencies and use approved host APIs. V1 has no arbitrary network or native-process capability.                      |
| Saved data schema mismatch       | Load a compatible version. V1 does not automatically migrate data. Back up data before a deliberate manual migration.                      |
| App stopped responding           | The host terminates the worker after its deadline. Inspect a reload and load again. Saved completed writes remain.                         |
| Codex unavailable                | Install the CLI and complete `codex login`; check again. See `docs/codex.md` for supported configuration.                                  |
| Codex usage/auth failure         | Resolve it in the official CLI. No failed response is treated as a completed assessment.                                                   |
| Cache changed                    | Clear inactive cache and inspect again. Do not manually modify a running snapshot.                                                         |

Diagnostics: open Applications → Host tools → View/Export logs. These records
contain host stages and error codes only. More detailed package-authored errors
are shown in the current application session without being persisted to logs.

The initial source checkout must be tested on the operating systems where it
will be used. A produced bundle is not evidence of a signed, installed and
verified distribution. Consult `validation/acceptance.md` before delivery.
