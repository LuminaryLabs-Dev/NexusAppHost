# Acceptance evidence — 2026-09-08

The source implementation and working examples are delivered with explicit
platform-validation limits. A source bundle is not an installer certification.

| Area                         | Evidence                                                                                                      | Result                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Dependency reproducibility   | Exact npm versions and lockfile; installed in sandbox                                                         | Pass                                                        |
| Source validation            | `npm run validate`: syntax plus service/contract/Codex fixtures and actual Python                             | Pass; see latest command output                             |
| Manifest and protocol        | Unsupported APIs, missing fields, unknown capabilities, invalid paths, oversized messages                     | Pass                                                        |
| Acquisition                  | Local snapshot stability; GitHub branch/tag/full SHA fixtures; failed/cancelled staging cleanup               | Pass                                                        |
| Data                         | Concurrent writes, origin isolation, version continuity, schema mismatch refusal, cache independence          | Pass                                                        |
| ESM native runtime           | Actual Electron renderer Worker lifecycle, storage and stop/reload                                            | Pass in controlled fixture environment                      |
| Python                       | Actual bundled interpreter, wheel installation and structured persistent results; repeated in Electron Worker | Pass                                                        |
| Runtime restrictions         | Node/native-file/external-network imports denied; ungranted storage and oversized output rejected             | Pass in controlled fixture environment                      |
| Recovery                     | Infinite-loop watchdog terminates runtime; replacement loads and saved data remains                           | Pass                                                        |
| OS sandbox                   | Root-container tests require `--no-sandbox`; production prohibits that flag                                   | Not certified; regular-user test required                   |
| UI visual/interaction review | Exact local preview was served; browser rejected local URL access by policy                                   | Blocked; no screenshots or recording claimed                |
| Codex                        | Schema validation, evidence IDs, failed/tool events, no auth, cancellation, output and timeout limits         | Fixture/process tests pass; live authentication unavailable |
| Linux packaging              | `npm run package` created `dist/linux-unpacked`                                                               | Build passes; installed distribution unverified             |
| Windows/macOS                | Native build scripts supplied                                                                                 | Not built/installed/tested here                             |

`native-results.json` records native integration assertions and actual Electron,
Chromium, Node and V8 versions. It explicitly records whether the Chromium OS
sandbox was tested. No research records, authentication material or production
scraping were used.

## Reproduce on a desktop

```sh
npm ci
npm run validate
npm run test:desktop
npm start
```

Run as a normal desktop user. The repository's `--root-fixtures` test option is
only for deterministic fixture packages in a disposable root container; do not
use it to run actual downloaded apps. Packaged applications reject that bypass.

For the visual walkthrough: inspect/load Field Notes; save; open/close the panel;
stop/reload; change source/ref; cancel an inspection; inspect an invalid package;
inspect logs; clear inactive cache; verify retained data; repeat with Signal
Check; test Tab/Shift-Tab, Enter/Space, Escape, Ctrl/Cmd-K, reduced motion and a
420px window. No account or source data is needed.
