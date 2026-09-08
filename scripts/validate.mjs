import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
};
async function walk(root) {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (/\.(mjs|cjs|js)$/.test(file))
      run(process.execPath, ["--check", file]);
  }
}
for (const root of ["src", "scripts", "examples", "tests"]) await walk(root);
run(process.execPath, ["--test", "tests/*.test.mjs"]);
console.log(
  "Source syntax and automated checks passed. See validation/acceptance.md for platform evidence.",
);
