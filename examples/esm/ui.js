const note = document.getElementById("note"),
  status = document.getElementById("status");
const perform = async (button, fn) => {
  button.disabled = true;
  try {
    await fn();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
};
(async () => {
  try {
    await nexus.ready;
    note.value = (await nexus.request("read")) || "";
    status.textContent = "Ready. Your note is stored only when you save.";
  } catch (error) {
    status.textContent = error.message;
  }
})();
document.getElementById("save").onclick = function () {
  perform(this, async () => {
    const result = await nexus.request("save", { text: note.value });
    status.textContent = `Saved ${result.characters} characters.`;
  });
};
document.getElementById("assess").onclick = function () {
  perform(this, async () => {
    status.textContent = "Waiting for Codex assessment…";
    const result = await nexus.request("assess", { text: note.value });
    document.getElementById("result").textContent = JSON.stringify(
      result,
      null,
      2,
    );
    document.getElementById("assessment").hidden = false;
    status.textContent = "Assessment returned. Review before acting.";
  });
};
