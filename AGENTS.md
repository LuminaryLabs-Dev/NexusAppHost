# NexusAppHost working rules

Keep hosted code outside the main process. Do not weaken sandbox, CSP, IPC sender,
capability, origin, path or quota checks to make an example pass. No downloaded
install scripts, native wheels, unrestricted network or shell capabilities.

Run `npm run validate` after changes. Record actual platform/runtime validation in
`validation/acceptance.md`; distinguish fixture tests from live integrations.
Keep personal data, auth material, caches, node_modules and installers out of git.
Preserve LICENSE. Do not add workflows, branches or PRs without a user request.
