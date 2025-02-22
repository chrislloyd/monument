// buildSystem.ts
import { promises as fs } from "fs";
import { spawn } from "bun";
import { createHash } from "crypto";

type Action = (out: string) => Promise<void>;

// ------------------------------------------------------------------
// Interfaces and Global Registries
// ------------------------------------------------------------------
type Rule = {
  target: string;
  action: Action;
};

type Hash = string;

interface BuildRecord {
  hash: Hash;
  // Mapping: dependency (file or command) -> hash at time of the last build
  deps: { [dep: string]: Hash };
}

const RULES: Map<string, Rule> = new Map();
// Tracks targets that are currently being built
const inProgress: Map<string, Promise<void>> = new Map();
// Persistent build state loaded from disk and updated after a build
const buildState: Map<string, BuildRecord> = new Map();
// During a build, tracks dynamically discovered dependencies for the target currently being built
const currentDeps: Map<string, { [dep: string]: string }> = new Map();
// Stack to keep track of the current target (to record dependencies in parent's build record)
const currentTargetStack: string[] = [];

// ------------------------------------------------------------------
// Hashing utilities
// ------------------------------------------------------------------
async function hashFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath);
    return createHash("sha256").update(content).digest("hex");
  } catch (err) {
    console.log(`[hashFile] Error hashing ${filePath}: ${err}`);
    return "missing-file";
  }
}

function hashCommand(cmd: string): string {
  return createHash("sha256").update(cmd).digest("hex");
}

// ------------------------------------------------------------------
// Persistent State Management
// ------------------------------------------------------------------
async function loadBuildState(): Promise<void> {
  try {
    const content = await fs.readFile("build_state.json", "utf8");
    const obj = JSON.parse(content);
    for (const [target, record] of Object.entries(obj)) {
      buildState.set(target, record as BuildRecord);
    }
    console.log("[loadBuildState] Loaded build_state.json.");
  } catch (err) {
    console.log(
      "[loadBuildState] No previous build_state.json found. Starting fresh.",
    );
  }
}

async function saveBuildState(): Promise<void> {
  // Convert buildState Map to an object
  const obj = Object.fromEntries(buildState);
  await fs.writeFile("build_state.json", JSON.stringify(obj, null, 2));
  console.log("[saveBuildState] Build state saved to build_state.json.");
}

// ------------------------------------------------------------------
// Rule Registration
// ------------------------------------------------------------------
function registerRule(
  target: string,
  func: (target: string) => Promise<void>,
): void {
  RULES.set(target, { target, action: func });
}

// ------------------------------------------------------------------
// Utility to run shell commands asynchronously using Bun
// ------------------------------------------------------------------
async function runShell(cmd: string): Promise<string> {
  console.log(`[runShell] Executing: ${cmd}`);

  // Record command as a dependency if we have a current target
  if (currentTargetStack.length > 0) {
    const parent = currentTargetStack[currentTargetStack.length - 1];
    if (!parent) throw new Error();

    const parentDeps = currentDeps.get(parent) || {};
    const cmdKey = `cmd:${cmd}`;
    const cmdHash = hashCommand(cmd);
    parentDeps[cmdKey] = cmdHash;
    currentDeps.set(parent, parentDeps);
  }

  const process = spawn(["bash", "-c", cmd], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await process.exited;
  const { stdout, stderr, exitCode } = process;
  if (exitCode !== 0) {
    console.error(`[runShell] Error: ${stderr.toString()}`);
    throw new Error(`Command failed: ${cmd}`);
  }
  return await new Response(stdout).text();
}

// ------------------------------------------------------------------
// Incremental Rebuild Check
// ------------------------------------------------------------------
async function isUpToDate(target: string): Promise<boolean> {
  try {
    const record = buildState.get(target);
    if (!record) return false;

    // Get the current hash of the target
    const currentTargetHash = await hashFile(target);

    // If target file hash changed from last build, it's not up to date
    if (currentTargetHash !== record.hash) {
      console.log(`[isUpToDate] ${target} hash changed - rebuilding`);
      return false;
    }

    // Check all dependencies
    for (const [dep, savedHash] of Object.entries(record.deps)) {
      // Check if this is a command dependency
      if (dep.startsWith("cmd:")) {
        const cmdHash = hashCommand(dep.substring(4));
        if (cmdHash !== savedHash) {
          console.log(
            `[isUpToDate] ${target} is outdated because command changed: ${dep.substring(4)}`,
          );
          return false;
        }
      } else {
        // It's a file dependency
        try {
          const currentHash = await hashFile(dep);
          if (currentHash !== savedHash) {
            console.log(
              `[isUpToDate] ${target} is outdated because ${dep} changed.`,
            );
            return false;
          }
        } catch {
          // If a dependency no longer exists, force a rebuild
          console.log(
            `[isUpToDate] ${target} is outdated because dependency ${dep} is missing.`,
          );
          return false;
        }
      }
    }

    return true;
  } catch (err) {
    console.log(`[isUpToDate] Error checking ${target}: ${err}`);
    return false;
  }
}

// ------------------------------------------------------------------
// Core Build Functions: buildTarget and need
// ------------------------------------------------------------------
async function buildTarget(target: string): Promise<void> {
  // Check if target exists and is up-to-date
  if (await isUpToDate(target)) {
    console.log(`[buildTarget] ${target} is up-to-date; skipping build.`);
    return;
  }

  if (inProgress.has(target)) {
    await inProgress.get(target);
    return;
  }

  const buildPromise = (async () => {
    console.log(`[buildTarget] Building ${target}...`);
    // Push the target onto the current target stack
    currentTargetStack.push(target);
    // Initialize dependency collection for this target
    currentDeps.set(target, {});

    const ruleInfo = RULES.get(target);
    if (!ruleInfo) {
      throw new Error(`No rule defined for target: ${target}`);
    }

    // Execute the build action
    await ruleInfo.action(target);

    // Update the build record with collected dependencies and target hash
    const hash = await hashFile(target);
    const deps = currentDeps.get(target) || {};
    buildState.set(target, { hash, deps });

    // Finished building; pop the target from the stack
    currentTargetStack.pop();
    // Clean up the currentDeps entry
    currentDeps.delete(target);

    console.log(`[buildTarget] Finished building ${target}.`);
  })();

  inProgress.set(target, buildPromise);
  await buildPromise;
  inProgress.delete(target);
}

async function need(target: string): Promise<void> {
  // Build the dependency
  await buildTarget(target);

  // Record the dependency in the parent's currentDeps (if a parent exists)
  if (currentTargetStack.length > 0) {
    const parent = currentTargetStack[currentTargetStack.length - 1];
    if (!parent) throw new Error();

    const depHash = await hashFile(target);

    // Get current dependencies for the parent
    const parentDeps = currentDeps.get(parent) || {};
    // Add this target as a dependency
    parentDeps[target] = depHash;
    // Update the parent's dependency map
    currentDeps.set(parent, parentDeps);

    console.log(`[need] Recorded dependency: ${parent} depends on ${target}`);
  }
}

// ------------------------------------------------------------------
// Build Graph Export (for visualization)
// ------------------------------------------------------------------
async function exportBuildGraph(filename = "build_graph.dot"): Promise<void> {
  let graph = "digraph build {\n";
  for (const [target, record] of buildState.entries()) {
    for (const dep in record.deps) {
      // Clean up command names for the graph
      const depLabel = dep.startsWith("cmd:")
        ? `"cmd: ${dep.substring(4).slice(0, 30)}..."`
        : `"${dep}"`;
      graph += `  ${depLabel} -> "${target}";\n`;
    }
  }
  graph += "}\n";
  await fs.writeFile(filename, graph);
  console.log(`[exportBuildGraph] Build graph written to ${filename}`);
}

// ------------------------------------------------------------------
// Example Build Rules (with both file and command dependencies)
// ------------------------------------------------------------------
registerRule("source.txt", async (target: string) => {
  console.log(`[build_source] Creating ${target}...`);
  await fs.writeFile(
    target,
    "Hello, incremental builds with Bun/TypeScript!\n",
  );
  // Simulate work
  await new Promise((resolve) => setTimeout(resolve, 100));
});

registerRule("file.txt", async (target: string) => {
  console.log(`[build_file] Building ${target} from source.txt`);
  // Dynamically declare dependency on "source.txt"
  await need("source.txt");
  const content = await fs.readFile("source.txt", "utf8");
  await fs.writeFile(target, content.toUpperCase());
  await new Promise((resolve) => setTimeout(resolve, 100));
});

registerRule("greeting.txt", async (target: string) => {
  console.log(`[build_greeting] Building ${target} from file.txt`);
  await need("file.txt");
  const content = await fs.readFile("file.txt", "utf8");
  await fs.writeFile(target, content + "\nHave a great day!");
  await new Promise((resolve) => setTimeout(resolve, 100));
});

registerRule("ls.txt", async (out) => {
  // This will now be recorded as a command dependency
  const ls = await runShell("ls");
  await fs.writeFile(out, ls);
});

// ------------------------------------------------------------------
// Main Entry Point
// ------------------------------------------------------------------
async function main(): Promise<void> {
  await loadBuildState();
  // Specify the top-level target to build
  const targets = ["greeting.txt", "ls.txt"];
  try {
    await Promise.all(targets.map((target) => buildTarget(target)));
  } catch (err) {
    console.error(`Build failed: ${err}`);
    process.exit(1);
  }
  await exportBuildGraph();
  await saveBuildState();
}

await main();
