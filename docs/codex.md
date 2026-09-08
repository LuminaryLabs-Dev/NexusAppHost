# Optional Codex assessment bridge

Install the official Codex CLI locally, then run:

```sh
codex --version
codex login
codex login status
```

Choose ChatGPT sign-in in the official login flow. Being signed into a browser
tab alone does not authenticate a separate local CLI. Nexus never copies tokens,
reads authentication files or changes the CLI's credential store. The capability
uses the CLI's default login under the desktop user's home directory. Custom
`CODEX_HOME` layouts and configuration profiles are not supported by this V1.
Windows requires a native executable available on PATH, not a shell-only alias.

In Applications → Host tools, **Check Codex connection** probes version, exec
options and login status. The installed version must advertise `--json`,
`--output-schema`, `--ephemeral` and `--sandbox`. Then explicitly approve the
package's `codex.assess` capability when loading it. Supplied evidence is sent to
the model through the installed CLI and consumes the available account usage.

```js
const assessment = await nexus.assess({
  schema: "lead-assessment-v1",
  criteria: ["Evidence of a relevant training need"],
  evidence: [{ id: "source-1", text: "A sourced company announcement…" }],
});
```

The fixed output schema contains `strengths`, `weaknesses`,
`missingInformation`, `nextSteps` and `evidenceIds`. Nexus rejects unknown fields,
invented evidence IDs, malformed JSON, failed CLI turns and observed tool events.
It never converts failure into an assessment and never marks a lead approved.
The engine retains human review and owns all qualification policy.

## Execution policy

The adapter uses shell-free process creation, a temporary working directory,
an approved output schema, ephemeral execution, read-only sandboxing and no
approval prompts. Shell, unified execution, patching, JS execution, app/plugin,
multi-agent, image and web-search tool settings are disabled. It rejects user
configurations with MCP servers, profiles, plugins, hooks or notify commands
rather than silently inheriting them. Input/output sizes, one-at-a-time execution,
cancellation and a two-minute exec timeout are bounded.

CLI options and managed policy can vary. **Live authenticated inference was not
available in this sandbox.** The adapter is tested with deterministic CLI fixtures
and real process failures; it is not certified for every Codex release or managed
configuration. Before enabling it for production research, validate the exact
installed CLI and effective tool policy with harmless sample evidence. A tool
event rejection is a failed assessment, not evidence that a tool could not have
started; the CLI's restrictions must remain effective. Do not weaken host checks
to bypass a configuration rejection.

No credentials or raw prompts are added to Nexus diagnostics. OpenAI/Codex's own
credential, network, usage and retention behavior remains under the CLI's control.

Sources: [Codex authentication](https://developers.openai.com/codex/auth),
[non-interactive execution](https://developers.openai.com/codex/noninteractive),
[configuration reference](https://developers.openai.com/codex/config-reference/).
