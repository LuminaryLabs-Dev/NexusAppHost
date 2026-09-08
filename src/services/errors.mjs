export class HostError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "HostError";
    this.code = code;
  }
}
export function check(condition, code, message) {
  if (!condition) throw new HostError(code, message);
}
export function publicError(error) {
  if (error?.name === "TimeoutError")
    return {
      code: "TIMEOUT",
      message:
        "The source did not respond before the download deadline. Retry or use a local folder.",
    };
  if (error?.code === "ENOENT")
    return {
      code: "MISSING_FILE",
      message:
        "A required package file or directory is missing. Check the manifest path and entries.",
    };
  if (error?.name === "AbortError")
    return {
      code: "CANCELLED",
      message: "Operation cancelled. Your previous package remains available.",
    };
  return {
    code: error?.code || "HOST_ERROR",
    message:
      error instanceof HostError
        ? error.message
        : "The operation failed. Retry or inspect the diagnostic log.",
  };
}
export function bounded(value, max = 262144) {
  let text;
  try {
    text = JSON.stringify(value);
  } catch {
    throw new HostError("PAYLOAD", "Payload must be JSON.");
  }
  check(
    typeof text === "string" && Buffer.byteLength(text) <= max,
    "PAYLOAD",
    "Payload exceeds the JSON size limit.",
  );
  return JSON.parse(text);
}
