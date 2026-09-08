import {
  mkdir,
  readFile,
  writeFile,
  rename,
  rm,
  readdir,
  open,
} from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { bounded, check } from "./errors.mjs";
export const hash = (value) => createHash("sha256").update(value).digest("hex");
export async function atomic(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temp, "wx", 0o600);
    try {
      await handle.writeFile(JSON.stringify(value, null, 2));
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, file);
  } finally {
    await rm(temp, { force: true });
  }
}
export async function json(file, fallback) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
}
export class Storage {
  constructor(root) {
    this.root = root;
    this.queues = new Map();
  }
  async init() {
    for (const name of ["cache", "staging", "data", "logs", "environments"])
      await mkdir(path.join(this.root, name), { recursive: true, mode: 0o700 });
    await rm(path.join(this.root, "staging"), { recursive: true, force: true });
    await mkdir(path.join(this.root, "staging"));
  }
  identity(pkg) {
    return hash(`${pkg.origin}\n${pkg.manifest.id}`);
  }
  file(pkg) {
    return path.join(this.root, "data", this.identity(pkg), "data.json");
  }
  async prepare(pkg) {
    const file = this.file(pkg),
      saved = await json(file, null);
    check(
      !saved || saved.schema === pkg.manifest.dataSchemaVersion,
      "DATA_SCHEMA",
      "Saved data uses a different schema. This host does not automatically migrate or delete it.",
    );
    if (!saved)
      await atomic(file, {
        schema: pkg.manifest.dataSchemaVersion,
        values: {},
      });
  }
  async get(pkg, key) {
    this.key(key);
    const state = await json(this.file(pkg), null);
    return Object.hasOwn(state.values, key) ? state.values[key] : null;
  }
  key(key) {
    check(
      typeof key === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(key),
      "STORAGE_KEY",
      "Storage keys must be simple names up to 80 characters.",
    );
  }
  async set(pkg, key, value) {
    this.key(key);
    value = bounded(value, 65536);
    const file = this.file(pkg);
    const previous = this.queues.get(file) || Promise.resolve();
    const task = previous
      .catch(() => {})
      .then(async () => {
        const state = await json(file, null);
        state.values[key] = value;
        bounded(state, 4 * 1024 * 1024);
        check(
          Object.keys(state.values).length <= 256,
          "QUOTA",
          "This app has reached its 256-key storage quota.",
        );
        await atomic(file, state);
        return value;
      });
    this.queues.set(file, task);
    try {
      return await task;
    } finally {
      if (this.queues.get(file) === task) this.queues.delete(file);
    }
  }
  async preferences(value) {
    if (value !== undefined)
      await atomic(path.join(this.root, "preferences.json"), value);
    return json(path.join(this.root, "preferences.json"), {});
  }
  async clearCache(activeKey) {
    for (const entry of await readdir(path.join(this.root, "cache")))
      if (entry !== activeKey)
        await rm(path.join(this.root, "cache", entry), {
          recursive: true,
          force: true,
        });
  }
  async deleteData(pkg) {
    const file = this.file(pkg);
    await this.queues.get(file)?.catch(() => {});
    await rm(path.dirname(file), { recursive: true, force: true });
  }
}
export class Logs {
  constructor(root) {
    this.file = path.join(root, "logs", "diagnostics.json");
    this.rows = [];
    this.pending = Promise.resolve();
  }
  async init() {
    this.rows = (await json(this.file, [])).slice(-200);
  }
  add(stage, code, detail = "") {
    // Deliberately record only host-controlled categories, never package output,
    // prompts, environment, paths, URLs, auth messages or raw exception text.
    this.rows.push({
      time: new Date().toISOString(),
      stage: String(stage)
        .replace(/[^a-zA-Z0-9_.-]/g, "")
        .slice(0, 40),
      code: String(code)
        .replace(/[^a-zA-Z0-9_.-]/g, "")
        .slice(0, 40),
      detail: ["started", "complete", "cancelled", "failed"].includes(detail)
        ? detail
        : "",
    });
    this.rows = this.rows.slice(-200);
    const rows = structuredClone(this.rows);
    this.pending = this.pending
      .catch(() => {})
      .then(() => atomic(this.file, rows));
    return this.pending;
  }
}
