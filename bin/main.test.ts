import { spawn } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runPersistentProcess(filePath: string) {
  const child = spawn("bun", ["run", "3.ts", filePath]);
  let output: string[] = [];

  child.stdout.on("data", (data) => {
    output.push(data.toString().trim());
  });

  return {
    process: child,
    getLastOutput: () => output[output.length - 1] || "",
    waitForUpdate: async (expected: string, timeout = 2000) => {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        if (output.includes(expected)) return true;
        await wait(100);
      }
      return false;
    },
    kill: () => {
      child.kill();
    },
  };
}

describe("process-document integration tests", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "process-document-test-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("Watches file and updates on change", async () => {
    const parentPath = join(tempDir, "a.md");
    const childPath = join(tempDir, "b.md");

    await writeFile(childPath, "World");
    await writeFile(parentPath, "Hello ![](b.md)");

    const { process, getLastOutput, waitForUpdate, kill } = await runPersistentProcess(parentPath);

    expect(await waitForUpdate("Hello World")).toBe(true);

    // Modify the child document
    await writeFile(childPath, "Earth");
    expect(await waitForUpdate("Hello Earth")).toBe(true);

    // Cleanup
    kill();
  });

  test("Removes transclusion watcher when reference is removed", async () => {
    const parentPath = join(tempDir, "a.md");
    const childPath = join(tempDir, "b.md");

    await writeFile(childPath, "World");
    await writeFile(parentPath, "Hello ![](b.md)");

    const { process, waitForUpdate, kill } = await runPersistentProcess(parentPath);
    expect(await waitForUpdate("Hello World")).toBe(true);

    // Remove transclusion from parent
    await writeFile(parentPath, "Hello world");
    expect(await waitForUpdate("Hello world")).toBe(true);

    // Change child, parent should no longer be affected
    await writeFile(childPath, "Earth");
    await wait(500); // Give it time
    expect(await waitForUpdate("Hello Earth")).toBe(false);

    kill();
  });

  test("Handles multiple transclusions and file graph correctly", async () => {
    const rootPath = join(tempDir, "root.md");
    const aPath = join(tempDir, "a.md");
    const bPath = join(tempDir, "b.md");
    const cPath = join(tempDir, "c.md");
    const dPath = join(tempDir, "d.md");

    await writeFile(dPath, "D");
    await writeFile(bPath, "B ![](d.md)");
    await writeFile(cPath, "C ![](d.md)");
    await writeFile(aPath, "A ![](b.md) ![](c.md)");
    await writeFile(rootPath, "Root ![](a.md)");

    const { process, waitForUpdate, kill } = await runPersistentProcess(rootPath);

    expect(await waitForUpdate("Root A B D C D")).toBe(true);

    // Modify D and ensure the update propagates
    await writeFile(dPath, "NewD");
    expect(await waitForUpdate("Root A B NewD C NewD")).toBe(true);

    kill();
  });
});
