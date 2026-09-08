import { randomUUID } from "node:crypto";
import { bounded, check, HostError, publicError } from "./errors.mjs";
import { hash } from "./storage.mjs";
import { readFile } from "node:fs/promises";
import { inside } from "./contracts.mjs";
export class Host {
  constructor({
    storage,
    packages,
    logs,
    codex,
    createRuntime,
    emit = () => {},
  }) {
    Object.assign(this, {
      storage,
      packages,
      logs,
      codex,
      createRuntime,
      emit,
    });
    this.state = {
      stage: "empty",
      detail: "Choose an application to begin.",
      candidate: null,
      active: null,
      error: null,
      taskProgress: null,
    };
    this.operation = null;
    this.current = null;
    this.runtime = null;
    this.grants = new Set();
    this.controllers = new Set();
    this.capabilityCount = 0;
  }
  summary(pkg) {
    if (!pkg) return null;
    const { key, origin, revision, source, manifest, bytes } = pkg;
    return { key, origin, revision, source, manifest, bytes };
  }
  update(value) {
    Object.assign(this.state, value);
    this.emit(structuredClone(this.state));
  }
  async initialize() {
    await this.storage.init();
    await this.logs.init();
    this.state.preferences = await this.storage.preferences();
    return this.state;
  }
  async exclusive(fn) {
    check(!this.operation, "BUSY", "Another package operation is running.");
    const controller = new AbortController();
    this.operation = controller;
    try {
      return await fn(controller.signal);
    } catch (error) {
      this.update({
        stage: "error",
        error: publicError(error),
        detail: publicError(error).message,
      });
      await this.logs.add("operation", error.code || "FAILED", "failed");
      throw error;
    } finally {
      if (this.operation === controller) this.operation = null;
    }
  }
  async detect(spec) {
    return this.exclusive(async (signal) => {
      this.update({
        stage: "detecting",
        error: null,
        detail: "Inspecting the source…",
        candidate: null,
      });
      this.candidate = null;
      const pkg = await this.packages.detect(spec, signal, (stage, detail) =>
        this.update({ stage: "detecting", detail }),
      );
      signal.throwIfAborted();
      this.candidate = pkg;
      this.update({
        stage: "review",
        candidate: this.summary(pkg),
        detail: "Review the source and access before loading.",
      });
      return this.state;
    });
  }
  async load({ key, grants }) {
    return this.exclusive(async (signal) => {
      const pkg = this.candidate;
      check(
        pkg?.key === key,
        "REVIEW_REQUIRED",
        "Inspect and review this exact package before loading.",
      );
      check(
        Array.isArray(grants) &&
          grants.every((c) => pkg.manifest.capabilities.includes(c)) &&
          new Set(grants).size === grants.length,
        "CAPABILITY",
        "Only requested capabilities can be approved.",
      );
      this.update({
        stage: "loading",
        detail: "Verifying snapshot integrity…",
        error: null,
      });
      for (const [name, digest] of pkg.files) {
        signal.throwIfAborted();
        check(
          hash(await readFile(await inside(pkg.root, name))) === digest,
          "INTEGRITY",
          "Cached files have changed. Clear inactive cache and inspect again.",
        );
      }
      await this.storage.prepare(pkg);
      signal.throwIfAborted();
      this.stopRuntime();
      this.update({ active: null, taskProgress: null });
      const generation = randomUUID();
      this.current = pkg;
      this.generation = generation;
      this.grants = new Set(grants);
      this.appAbort = new AbortController();
      this.runtime = this.createRuntime({
        pkg,
        generation,
        capability: (op, payload) => this.capability(generation, op, payload),
        onProgress: (message) => {
          if (this.generation === generation)
            this.update({ taskProgress: message });
        },
        onCrash: (error) => {
          if (this.generation === generation) {
            this.stopRuntime();
            this.update({
              stage: "error",
              error,
              active: null,
              detail: error.message,
            });
          }
        },
      });
      this.update({
        detail:
          pkg.manifest.runtime.kind === "python-wheel"
            ? "Installing pure-Python wheels into an isolated interpreter…"
            : "Starting the isolated module…",
      });
      try {
        await this.runtime.start(signal);
        signal.throwIfAborted();
        await this.storage.preferences({ lastSource: pkg.source });
        signal.throwIfAborted();
        this.update({
          stage: "ready",
          active: {
            ...this.summary(pkg),
            generation,
            grants: [...this.grants],
          },
          detail: "Application ready.",
          taskProgress: null,
        });
        await this.logs.add("runtime", "READY", "complete");
        return this.state;
      } catch (error) {
        this.stopRuntime();
        this.update({ active: null });
        throw error;
      }
    });
  }
  stopRuntime() {
    this.appAbort?.abort();
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
    this.grants.clear();
    this.generation = null;
    this.runtime?.stop();
    this.runtime = null;
    this.current = null;
  }
  stop() {
    check(
      !this.operation,
      "BUSY",
      "Cancel the package operation before stopping.",
    );
    this.stopRuntime();
    this.update({
      stage: this.candidate ? "review" : "empty",
      active: null,
      taskProgress: null,
      detail: "Application stopped. Saved data is preserved.",
    });
    return this.state;
  }
  cancel() {
    this.operation?.abort();
    return true;
  }
  async appCall({ generation, operation, payload }) {
    bounded(payload);
    check(
      generation === this.generation && this.runtime && this.state.active,
      "STOPPED",
      "This application session is no longer active.",
    );
    if (operation === "runtime.request")
      return this.runtime.request(payload?.method, payload?.data);
    return this.capability(generation, operation, payload);
  }
  async capability(generation, operation, payload) {
    bounded(payload);
    check(
      generation === this.generation && this.current,
      "STOPPED",
      "Application access has been revoked.",
    );
    check(this.capabilityCount < 32, "BUSY", "Too many capability requests.");
    const pkg = this.current;
    const required = operation.startsWith("storage.")
      ? "storage"
      : operation === "codex.assess"
        ? "codex.assess"
        : null;
    check(
      required && this.grants.has(required),
      "DENIED",
      "This operation was not approved for the application.",
    );
    this.capabilityCount++;
    try {
      if (operation === "storage.get") {
        check(
          payload && Object.keys(payload).every((k) => k === "key"),
          "PAYLOAD",
          "Invalid storage request.",
        );
        return await this.storage.get(pkg, payload.key);
      }
      if (operation === "storage.set") {
        check(
          payload &&
            Object.keys(payload).every((k) => ["key", "value"].includes(k)),
          "PAYLOAD",
          "Invalid storage request.",
        );
        return await this.storage.set(pkg, payload.key, payload.value);
      }
      if (operation === "codex.assess") {
        const controller = new AbortController();
        this.controllers.add(controller);
        try {
          return await this.codex.assess(payload, controller.signal);
        } finally {
          this.controllers.delete(controller);
        }
      }
      throw new HostError("DENIED", "Unknown operation.");
    } finally {
      this.capabilityCount--;
    }
  }
  async clearCache() {
    check(!this.operation, "BUSY", "Wait for the current operation.");
    await this.storage.clearCache(this.current?.key);
    if (this.candidate?.key !== this.current?.key) {
      this.candidate = null;
      this.update({ candidate: null });
    }
    return true;
  }
  async deleteData(key) {
    check(
      !this.operation && !this.runtime,
      "BUSY",
      "Stop the application before deleting its data.",
    );
    check(
      this.candidate?.key === key,
      "REVIEW_REQUIRED",
      "Select the application whose data should be deleted.",
    );
    await this.storage.deleteData(this.candidate);
    return true;
  }
}
