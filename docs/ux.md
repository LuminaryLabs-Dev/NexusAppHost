# Corner-panel interaction

The main application surface belongs to the loaded app. Nexus keeps controls in
the upper-right Applications button. Hover/focus reveals a short hint; only
click, tap, Enter, Space or Ctrl/Cmd-K opens the panel. Closing it preserves the
running application. Escape returns focus to the opener. The modal traps Tab
focus and makes the background inert. Reduced-motion CSS removes transitions.

Flow: choose source → inspect → review identity and requested access → approve
and load → use app → manage. Inspection never runs package code. The review
shows the app name, version, runtime, source, full immutable revision, app ID and
data schema. Storage starts selected; Codex sharing is opt-in. Loading replaces
the current runtime only after snapshot integrity and data compatibility checks.

Inspection/load has its own progress region and Cancel control. Application
progress appears in the application strip. Failed operations keep source inputs
and show a stage-specific message. There is no invented percentage or automatic
lead-approval state. Inspect reload re-reads the original source and requires
review of the resulting package. Change version restores source controls while
showing the currently running version.

Cache cleanup and saved-data deletion are distinct. The latter is disabled
while an application is active and requires a native confirmation. Logs contain
bounded host categories, never research input or raw CLI messages.

`npm run preview` serves the actual HTML/CSS/JS without Electron. It explicitly
labels desktop features as unavailable; it does not mock successful loading.
Visual walkthrough, narrow-screen interaction and screen-reader checks remain
unverified because this session's browser policy blocked local URLs. Native
runtime/SDK transport has separate automated evidence.
