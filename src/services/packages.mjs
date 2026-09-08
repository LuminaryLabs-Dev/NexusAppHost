import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  lstat,
  realpath,
  rename,
  rm,
  open,
} from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import JSZip from "jszip";
import {
  manifest,
  inside,
  safePath,
  MAX_FILES,
  MAX_FILE,
  MAX_PACKAGE,
} from "./contracts.mjs";
import { check, HostError } from "./errors.mjs";
import { hash, atomic, json } from "./storage.mjs";
const SKIP = new Set([
  ".git",
  "node_modules",
  ".venv",
  "__pycache__",
  ".DS_Store",
]);
export function repository(value) {
  check(
    typeof value === "string",
    "SOURCE",
    "Enter a public GitHub repository.",
  );
  const name = value
    .trim()
    .replace(/^https:\/\/github\.com\//i, "")
    .replace(/\.git\/?$/, "")
    .replace(/\/$/, "");
  check(
    /^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}\/[a-zA-Z0-9_.-]{1,100}$/.test(name) &&
      !name.endsWith("/.."),
    "SOURCE",
    "Use owner/repository or its https://github.com URL.",
  );
  return name.toLowerCase();
}
async function bytes(response, signal, limit) {
  check(response.body, "NETWORK", "The source returned an empty response.");
  const chunks = [];
  let total = 0;
  for await (const chunk of response.body) {
    signal?.throwIfAborted();
    total += chunk.byteLength;
    check(total <= limit, "LIMIT", "The download exceeded its size limit.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
export class Packages {
  constructor(storage, { fetcher = fetch } = {}) {
    this.storage = storage;
    this.fetcher = fetcher;
  }
  async api(route, signal) {
    const response = await this.fetcher(`https://api.github.com${route}`, {
      signal: AbortSignal.any([
        signal || new AbortController().signal,
        AbortSignal.timeout(20000),
      ]),
      redirect: "error",
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "NexusAppHost/1.0",
      },
    });
    if (response.status === 403 || response.status === 429)
      throw new HostError(
        "RATE_LIMIT",
        "GitHub denied or rate-limited this request. Retry later; this host uses public access only.",
      );
    if (response.status === 401)
      throw new HostError(
        "AUTH_REQUIRED",
        "This source requires authentication. Use a public repository or a local folder.",
      );
    if (response.status === 404)
      throw new HostError(
        "NOT_FOUND",
        "Repository, reference or package was not found or is private.",
      );
    check(
      response.ok,
      "NETWORK",
      `GitHub returned HTTP ${response.status}. Retry the operation.`,
    );
    return JSON.parse(
      (await bytes(response, signal, 12 * 1024 * 1024)).toString("utf8"),
    );
  }
  async detect(spec, signal, progress = () => {}) {
    check(
      spec && ["local", "github"].includes(spec.kind),
      "SOURCE",
      "Choose GitHub or a local folder.",
    );
    const manifestPath = safePath(spec.manifestPath || "nexus-app.json");
    const folder = path.posix.dirname(manifestPath);
    const prefix = folder === "." ? "" : folder + "/";
    const stage = path.join(this.storage.root, "staging", randomUUID());
    const pkgRoot = path.join(stage, "package");
    await mkdir(pkgRoot, { recursive: true });
    const items = [];
    let total = 0,
      origin,
      revision,
      source;
    const put = async (name, data) => {
      signal?.throwIfAborted();
      safePath(name);
      check(
        items.length < MAX_FILES &&
          data.length <= MAX_FILE &&
          total + data.length <= MAX_PACKAGE,
        "LIMIT",
        "Package exceeds file count or size limits.",
      );
      total += data.length;
      items.push([name, hash(data)]);
      const out = path.join(pkgRoot, name);
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, data, { flag: "wx", mode: 0o600 });
    };
    try {
      if (spec.kind === "local") {
        check(
          typeof spec.directory === "string" && path.isAbsolute(spec.directory),
          "SOURCE",
          "Select an absolute local directory.",
        );
        const selected = await realpath(spec.directory);
        const root = prefix ? await inside(selected, folder) : selected;
        origin = `local:${root}`;
        source = { kind: "local", directory: selected, manifestPath };
        progress("snapshot", "Copying a stable local snapshot");
        const walk = async (dir, parent = "") => {
          for (const entry of (
            await readdir(dir, { withFileTypes: true })
          ).sort((a, b) => a.name.localeCompare(b.name))) {
            signal?.throwIfAborted();
            if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
            const rel = parent + entry.name;
            safePath(rel);
            const file = await inside(root, rel);
            const stat = await lstat(file);
            check(
              !stat.isSymbolicLink(),
              "PATH",
              "Symbolic links are not allowed.",
            );
            if (stat.isDirectory()) await walk(file, rel + "/");
            else {
              check(
                stat.isFile() && stat.size <= MAX_FILE,
                "LIMIT",
                "Package entries must be bounded regular files.",
              );
              const fd = await open(
                file,
                constants.O_RDONLY | (constants.O_NOFOLLOW || 0),
              );
              try {
                check(
                  (await fd.stat()).isFile(),
                  "PATH",
                  "Only regular files can be loaded.",
                );
                await put(rel, await fd.readFile());
              } finally {
                await fd.close();
              }
            }
          }
        };
        await walk(root);
        revision = hash(JSON.stringify(items));
      } else {
        const repo = repository(spec.repository);
        let ref = String(spec.ref || "").trim();
        check(
          ref.length <= 200 && !/[\x00-\x1f]/.test(ref),
          "SOURCE",
          "Invalid Git reference.",
        );
        progress("resolve", "Resolving an immutable GitHub commit");
        if (!ref) {
          const meta = await this.api(`/repos/${repo}`, signal);
          check(
            !meta.private,
            "SOURCE",
            "Only public repositories are supported.",
          );
          ref = meta.default_branch;
        }
        const commit = await this.api(
          `/repos/${repo}/commits/${encodeURIComponent(ref)}`,
          signal,
        );
        check(
          /^[a-f0-9]{40}$/.test(commit.sha),
          "SOURCE",
          "GitHub did not return a full commit ID.",
        );
        revision = commit.sha;
        origin = `github:${repo}:${folder}`;
        source = {
          kind: "github",
          repository: repo,
          ref: spec.ref || "",
          manifestPath,
        };
        const tree = await this.api(
          `/repos/${repo}/git/trees/${revision}?recursive=1`,
          signal,
        );
        check(
          !tree.truncated && Array.isArray(tree.tree),
          "LIMIT",
          "GitHub returned an incomplete file tree. Use a smaller repository.",
        );
        const entries = tree.tree.filter(
          (e) =>
            e.path.startsWith(prefix) &&
            e.type !== "tree" &&
            !e.path
              .slice(prefix.length)
              .split("/")
              .some((part) => part.startsWith(".") || SKIP.has(part)),
        );
        check(
          entries.length > 0 && entries.length <= MAX_FILES,
          "LIMIT",
          "Package is empty or has too many files.",
        );
        check(
          entries.every(
            (e) =>
              e.type === "blob" &&
              ["100644", "100755"].includes(e.mode) &&
              e.size <= MAX_FILE,
          ) && entries.reduce((n, e) => n + e.size, 0) <= MAX_PACKAGE,
          "LIMIT",
          "Symlinks, submodules or oversized files are not supported.",
        );
        for (const [index, entry] of entries.entries()) {
          signal?.throwIfAborted();
          progress(
            "download",
            `Retrieving file ${index + 1} of ${entries.length}`,
          );
          const blob = await this.api(
            `/repos/${repo}/git/blobs/${entry.sha}`,
            signal,
          );
          check(
            blob.encoding === "base64",
            "SOURCE",
            "Unsupported GitHub blob encoding.",
          );
          const data = Buffer.from(blob.content.replace(/\s/g, ""), "base64");
          check(
            data.length === entry.size,
            "INTEGRITY",
            "GitHub file size changed unexpectedly.",
          );
          await put(entry.path.slice(prefix.length), data);
        }
      }
      progress("validate", "Checking package contract and entries");
      const entryName = path.posix.basename(manifestPath);
      const entryFile = await inside(pkgRoot, entryName);
      let parsed;
      try {
        parsed = JSON.parse(await readFile(entryFile, "utf8"));
      } catch (error) {
        if (error instanceof SyntaxError)
          throw new HostError(
            "MANIFEST_JSON",
            "The manifest is not valid JSON.",
          );
        throw error;
      }
      const metadata = manifest(parsed);
      check(
        (await lstat(await inside(pkgRoot, metadata.ui))).isFile(),
        "ENTRY",
        "The UI entry must be a regular file.",
      );
      if (metadata.runtime.kind === "esm")
        check(
          (await lstat(await inside(pkgRoot, metadata.runtime.entry))).isFile(),
          "ENTRY",
          "The runtime entry must be a regular file.",
        );
      else
        for (const file of metadata.runtime.wheels)
          await inspectWheel(await readFile(await inside(pkgRoot, file)), file);
      const integrity = hash(
        JSON.stringify(items.sort((a, b) => a[0].localeCompare(b[0]))),
      );
      const key = hash(
        `${origin}\n${revision}\n${metadata.runtime.kind}\n${entryName}`,
      );
      const record = {
        key,
        origin,
        revision,
        integrity,
        source,
        manifest: metadata,
        files: items,
        bytes: total,
      };
      await atomic(path.join(stage, "record.json"), record);
      const destination = path.join(this.storage.root, "cache", key);
      signal?.throwIfAborted();
      try {
        await rename(stage, destination);
      } catch (e) {
        if (!["EEXIST", "ENOTEMPTY", "EPERM"].includes(e.code)) throw e;
        const existing = await json(
          path.join(destination, "record.json"),
          null,
        );
        check(
          existing?.integrity === integrity,
          "INTEGRITY",
          "An existing immutable cache entry has different content. Clear inactive cache and retry.",
        );
      }
      return { ...record, root: path.join(destination, "package") };
    } finally {
      await rm(stage, { recursive: true, force: true });
    }
  }
}
export async function inspectWheel(data, filename) {
  check(
    /-py3-none-any\.whl$/.test(filename),
    "WHEEL",
    "Only pure-Python py3-none-any wheels are supported.",
  );
  const zip = await JSZip.loadAsync(data);
  const files = [];
  let total = 0,
    metadata,
    wheel;
  for (const item of Object.values(zip.files)) {
    const name = item.unsafeOriginalName || item.name;
    safePath(name.replace(/\/$/, ""));
    check(
      name === item.name &&
        (Number(item.unixPermissions || 0) & 0o170000) !== 0o120000,
      "WHEEL",
      "Wheel contains a symlink or traversing path.",
    );
    if (item.dir) continue;
    check(
      !/\.(so|pyd|dll|dylib|exe|pth|pyc)$/i.test(name) &&
        !name.split("/").some((s) => s.endsWith(".data")),
      "WHEEL",
      "Native code, .pth startup hooks and .data installation schemes are unsupported.",
    );
    // Inspect advertised size before decompression; enforce actual size afterwards.
    check(
      item._data?.uncompressedSize <= MAX_FILE,
      "LIMIT",
      "Wheel entry is too large.",
    );
    total += item._data.uncompressedSize;
    check(
      total <= 8 * 1024 * 1024 && files.length < MAX_FILES,
      "LIMIT",
      "Wheel exceeds its extraction quota.",
    );
    const bytes = await item.async("uint8array");
    check(bytes.length <= MAX_FILE, "LIMIT", "Wheel entry is too large.");
    files.push({ name, bytes: Array.from(bytes) });
    if (name.endsWith(".dist-info/METADATA"))
      metadata = Buffer.from(bytes).toString();
    if (name.endsWith(".dist-info/WHEEL"))
      wheel = Buffer.from(bytes).toString();
  }
  check(
    metadata &&
      wheel &&
      /^Root-Is-Purelib: true\r?$/m.test(wheel) &&
      /^Tag: py3-none-any\r?$/m.test(wheel),
    "WHEEL",
    "Wheel metadata must declare a pure-Python py3-none-any build.",
  );
  check(
    !/^Requires-Dist:/m.test(metadata),
    "DEPENDENCIES",
    "V1 wheels must be dependency-free; vendor compatible pure-Python dependencies into the wheel.",
  );
  return files;
}
