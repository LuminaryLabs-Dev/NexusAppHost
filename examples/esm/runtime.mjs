let host;
export function activate(api) {
  host = api;
}
export async function request(method, data) {
  if (method === "read") return host.storage.get("note");
  if (method === "save") {
    if (typeof data?.text !== "string" || data.text.length > 10000)
      throw new Error("Enter a note of up to 10,000 characters.");
    await host.storage.set("note", data.text);
    host.progress("Note saved locally.");
    return { saved: true, characters: data.text.length };
  }
  if (method === "assess")
    return host.assess({
      schema: "lead-assessment-v1",
      criteria: [
        "Has evidence of a relevant immersive training need.",
        "Has a clear next research step.",
      ],
      evidence: [{ id: "note", text: String(data.text).slice(0, 4000) }],
    });
  throw new Error("Unknown Field Notes action.");
}
