import Ajv from "ajv";
import { readFile, lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { check, bounded } from "./errors.mjs";
const schema = JSON.parse(
  await readFile(
    new URL("../../contracts/manifest.schema.json", import.meta.url),
  ),
);
const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);
export const MAX_FILES = 512,
  MAX_FILE = 8 * 1024 * 1024,
  MAX_PACKAGE = 64 * 1024 * 1024;
export function safePath(value) {
  check(
    typeof value === "string" &&
      value.length > 0 &&
      value.length <= 240 &&
      !value.includes("\\") &&
      !value.includes("\0") &&
      !/[:?#%\x00-\x1f]/.test(value),
    "PATH",
    "Package paths must be plain relative paths.",
  );
  check(
    !value.startsWith("/") &&
      value.split("/").every((p) => p && p !== "." && p !== ".."),
    "PATH",
    "Absolute and traversing package paths are not allowed.",
  );
  return value;
}
export function manifest(value) {
  bounded(value, 32768);
  check(
    validate(value),
    "MANIFEST",
    `Invalid manifest: ${ajv.errorsText(validate.errors)}.`,
  );
  safePath(value.ui);
  check(
    /\.html$/.test(value.ui),
    "MANIFEST",
    "The UI entry must be an HTML file.",
  );
  if (value.runtime.kind === "esm") {
    safePath(value.runtime.entry);
    check(
      /\.m?js$/.test(value.runtime.entry),
      "MANIFEST",
      "ESM entries must end in .js or .mjs.",
    );
  } else
    for (const wheel of value.runtime.wheels) {
      safePath(wheel);
      check(
        /-py3-none-any\.whl$/.test(wheel),
        "WHEEL",
        "Only dependency-free py3-none-any wheels are supported.",
      );
    }
  return value;
}
export async function inside(root, relative) {
  safePath(relative);
  const base = await realpath(root);
  let current = base;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    check(
      !(await lstat(current)).isSymbolicLink(),
      "PATH",
      "Symbolic links are not allowed in packages.",
    );
  }
  const resolved = await realpath(current);
  check(
    resolved.startsWith(base + path.sep),
    "PATH",
    "Package path escapes its root.",
  );
  return resolved;
}
export function envelope(message, allowed) {
  bounded(message);
  check(
    message &&
      typeof message === "object" &&
      message.v === 1 &&
      typeof message.id === "string" &&
      /^[a-zA-Z0-9-]{1,80}$/.test(message.id) &&
      allowed.includes(message.op),
    "PROTOCOL",
    "Invalid runtime message.",
  );
  check(
    Object.keys(message).every((k) => ["v", "id", "op", "payload"].includes(k)),
    "PROTOCOL",
    "Unexpected runtime message field.",
  );
  return message;
}
