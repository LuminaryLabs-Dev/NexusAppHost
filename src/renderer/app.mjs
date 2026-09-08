const $ = (id) => document.getElementById(id);
const desktop = Boolean(window.nexusHost);
let state = { stage: "empty", active: null, candidate: null },
  kind = "github",
  returnFocus,
  frameGeneration,
  port,
  reviewKey;
const invoke = async (operation, payload = {}) => {
  if (!desktop) throw new Error("Open the desktop host to use this control.");
  const result = await window.nexusHost.invoke(operation, payload);
  if (!result.ok)
    throw Object.assign(new Error(result.error.message), {
      code: result.error.code,
    });
  return result.value;
};
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("toast").hidden = true), 5000);
}
async function action(fn) {
  try {
    return await fn();
  } catch (error) {
    toast(error.message);
  }
}
function openPanel() {
  returnFocus = document.activeElement;
  $("panel").hidden = false;
  $("backdrop").hidden = false;
  $("corner").setAttribute("aria-expanded", "true");
  $("workspace").inert = true;
  document.querySelector("header").inert = true;
  document.querySelector("footer").inert = true;
  $("close-panel").focus();
}
function closePanel() {
  $("panel").hidden = true;
  $("backdrop").hidden = true;
  $("corner").setAttribute("aria-expanded", "false");
  $("workspace").inert = false;
  document.querySelector("header").inert = false;
  document.querySelector("footer").inert = false;
  (returnFocus?.isConnected ? returnFocus : $("corner")).focus();
}
function sourceType(value) {
  kind = value;
  $("github-fields").hidden = kind !== "github";
  $("local-fields").hidden = kind !== "local";
  for (const name of ["github", "local"]) {
    $(`${name}-tab`).classList.toggle("selected", name === kind);
    $(`${name}-tab`).setAttribute("aria-pressed", String(name === kind));
  }
}
function setSource(spec) {
  sourceType(spec.kind);
  $("manifest").value = spec.manifestPath || "nexus-app.json";
  if (spec.kind === "github") {
    $("repository").value = spec.repository;
    $("reference").value = spec.ref || "";
  } else $("directory").value = spec.directory;
}
function getSource() {
  return kind === "github"
    ? {
        kind,
        repository: $("repository").value,
        ref: $("reference").value,
        manifestPath: $("manifest").value,
      }
    : {
        kind,
        directory: $("directory").value,
        manifestPath: $("manifest").value,
      };
}
function render(next) {
  state = next;
  const busy = ["detecting", "loading"].includes(state.stage),
    active = state.active,
    pkg = state.candidate;
  $("operation").hidden = !busy;
  $("operation-label").textContent =
    state.stage === "loading" ? "Loading application" : "Inspecting package";
  $("operation-detail").textContent = state.detail || "";
  for (const element of $("source-form").elements)
    element.disabled = busy || !desktop;
  for (const id of ["stop", "reload", "change-version", "clear-cache", "load"])
    $(id).disabled = busy || !desktop;
  $("error").hidden = !state.error;
  $("error-code").textContent = state.error?.code || "";
  $("error-message").textContent = state.error?.message || "";
  $("top-status").textContent = busy
    ? "Preparing application"
    : active
      ? "Application running"
      : "Workspace ready";
  $("status-dot").classList.toggle("live", Boolean(active));
  $("panel-status").textContent = busy
    ? state.detail
    : active
      ? "Application running"
      : "No application loaded";
  $("active-card").hidden = !active;
  $("manage-name").textContent = active?.manifest.name || "";
  $("manage-version").textContent = active
    ? `v${active.manifest.version} · ${active.manifest.runtime.kind}`
    : "";
  $("welcome").hidden = Boolean(active);
  $("app-surface").hidden = !active;
  if (active) {
    $("active-name").textContent = active.manifest.name;
    $("active-version").textContent = `v${active.manifest.version}`;
    if (frameGeneration !== active.generation) {
      port?.close();
      frameGeneration = active.generation;
      $("app-frame").src =
        `nexus-pkg://${active.generation}/${active.manifest.ui}`;
    }
  } else if (frameGeneration) {
    port?.close();
    frameGeneration = null;
    $("app-frame").removeAttribute("src");
  }
  $("task-progress").textContent = state.taskProgress || "";
  $("review").hidden = !pkg;
  if (pkg) {
    $("review-name").textContent = pkg.manifest.name;
    $("review-version").textContent = `v${pkg.manifest.version}`;
    $("review-runtime").textContent = pkg.manifest.runtime.kind;
    $("review-origin").textContent = pkg.origin;
    $("review-revision").textContent = pkg.revision;
    $("review-id").textContent = pkg.manifest.id;
    $("review-schema").textContent = String(pkg.manifest.dataSchemaVersion);
    if (reviewKey !== pkg.key) {
      reviewKey = pkg.key;
      $("capabilities").replaceChildren();
      for (const capability of pkg.manifest.capabilities) {
        const label = document.createElement("label");
        label.className = "capability";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = capability;
        checkbox.checked = capability === "storage";
        const text = document.createElement("span"),
          title = document.createElement("strong"),
          detail = document.createElement("small");
        title.textContent =
          capability === "storage"
            ? "Saved application data"
            : "Codex lead assessment";
        detail.textContent =
          capability === "storage"
            ? "Read and write this app’s own saved data."
            : "Send supplied evidence to Codex using your CLI login and available usage. No automatic lead approval.";
        text.append(title, detail);
        label.append(checkbox, text);
        $("capabilities").append(label);
      }
    }
    $("no-capabilities").hidden = pkg.manifest.capabilities.length > 0;
  } else reviewKey = null;
  $("delete-data").disabled = busy || Boolean(active) || !pkg;
  if (state.stage === "ready" && active)
    $("load").textContent = "Reload reviewed package";
  else $("load").textContent = "Approve and load ↗";
}
addEventListener("message", (event) => {
  if (
    event.source !== $("app-frame").contentWindow ||
    event.data?.type !== "nexus:hello" ||
    !state.active ||
    port?.generation === frameGeneration
  )
    return;
  const generation = frameGeneration,
    channel = new MessageChannel();
  port?.close();
  port = channel.port1;
  port.generation = generation;
  let inflight = 0;
  port.onmessage = async ({ data }) => {
    if (
      generation !== frameGeneration ||
      !data ||
      typeof data.id !== "string" ||
      !/^[a-zA-Z0-9-]{1,80}$/.test(data.id)
    )
      return;
    const answer = channel.port1;
    try {
      if (++inflight > 32 || JSON.stringify(data).length > 230000)
        throw new Error("Application request limit reached.");
      const response = await window.nexusHost.appCall({
        generation,
        operation: data.operation,
        payload: data.payload,
      });
      if (generation === frameGeneration)
        answer.postMessage({
          id: data.id,
          ...(response.ok
            ? { value: response.value }
            : { error: response.error }),
        });
    } catch (error) {
      answer.postMessage({
        id: data.id,
        error: { code: "APP_REQUEST", message: error.message },
      });
    } finally {
      inflight--;
    }
  };
  port.start();
  event.source.postMessage({ type: "nexus:connect" }, "*", [channel.port2]);
});
$("corner").onclick = openPanel;
$("choose-app").onclick = openPanel;
$("close-panel").onclick = closePanel;
$("backdrop").onclick = closePanel;
document.querySelector(".brand").onclick = (event) => {
  event.preventDefault();
  openPanel();
};
addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    $("panel").hidden ? openPanel() : closePanel();
  }
  if (!$("panel").hidden && event.key === "Escape") {
    event.preventDefault();
    closePanel();
  }
  if (!$("panel").hidden && event.key === "Tab") {
    const focusable = [
      ...$("panel").querySelectorAll('button,input,summary,[tabindex="0"]'),
    ].filter((el) => !el.disabled && el.getClientRects().length);
    const first = focusable[0],
      last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
$("github-tab").onclick = () => sourceType("github");
$("local-tab").onclick = () => sourceType("local");
$("browse").onclick = () =>
  action(async () => {
    const directory = await invoke("chooseFolder");
    if (directory) $("directory").value = directory;
  });
$("source-form").onsubmit = (event) => {
  event.preventDefault();
  action(() => invoke("detect", getSource()));
};
for (const type of ["esm", "python"])
  $(`example-${type}`).onclick = () =>
    action(async () => {
      openPanel();
      if (!desktop)
        return toast("Start the desktop host to open this example.");
      const spec = await invoke("example", { kind: type });
      setSource(spec);
      await invoke("detect", spec);
    });
$("load").onclick = () =>
  action(async () => {
    const grants = [...$("capabilities").querySelectorAll("input:checked")].map(
      (el) => el.value,
    );
    await invoke("load", { key: state.candidate.key, grants });
    closePanel();
  });
$("stop").onclick = () => action(() => invoke("stop"));
$("cancel").onclick = () => action(() => invoke("cancel"));
$("reload").onclick = () =>
  action(async () => {
    const source = state.active.source;
    setSource(source);
    await invoke("detect", source);
  });
$("change-version").onclick = () => {
  setSource(state.active.source);
  (kind === "github" ? $("reference") : $("browse")).focus();
};
$("clear-cache").onclick = () =>
  action(async () => {
    await invoke("clearCache");
    toast("Inactive package cache cleared. Saved data was kept.");
  });
$("delete-data").onclick = () =>
  action(async () => {
    if (await invoke("deleteData", { key: state.candidate.key }))
      toast("Selected application data deleted.");
  });
$("show-logs").onclick = () =>
  action(async () => {
    $("log-output").textContent = JSON.stringify(await invoke("logs"), null, 2);
    $("log-output").hidden = false;
  });
$("export-logs").onclick = () =>
  action(async () => {
    if (await invoke("exportLogs")) toast("Diagnostic log exported.");
  });
$("codex-check").onclick = () =>
  action(async () => {
    const result = await invoke("codexStatus");
    $("codex-status").textContent =
      `${result.version ? result.version + " · " : ""}${result.message}`;
  });
if (desktop) {
  window.nexusHost.subscribe(render);
  action(async () => {
    const initial = await invoke("state");
    if (initial.preferences?.lastSource)
      setSource(initial.preferences.lastSource);
    render(initial);
  });
} else {
  $("preview-notice").hidden = false;
  render(state);
}
