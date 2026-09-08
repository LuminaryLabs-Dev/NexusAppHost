const status = document.getElementById("status"),
  result = document.getElementById("result");
(async () => {
  try {
    await nexus.ready;
    const saved = await nexus.request("history");
    result.textContent = saved ? JSON.stringify(saved, null, 2) : "";
    status.textContent = "Ready. Enter evidence to inspect.";
  } catch (error) {
    status.textContent = error.message;
  }
})();
document.getElementById("check").onclick = async function () {
  this.disabled = true;
  try {
    const value = await nexus.request("check", {
      text: document.getElementById("note").value,
    });
    result.textContent = JSON.stringify(value, null, 2);
    status.textContent = "Saved. This record still needs human review.";
  } catch (error) {
    status.textContent = error.message;
  } finally {
    this.disabled = false;
  }
};
