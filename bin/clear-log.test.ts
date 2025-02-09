import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Writable } from "node:stream";

describe("clear-log", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "clear-log-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  async function run(input: string, logPath: string): Promise<{ exitCode: number, logContent: string }> {
    const proc = Bun.spawn(["bun", "run", "bin/clear-log.ts", logPath], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });

    // Write input to stdin
    await proc.stdin.write(new TextEncoder().encode(input));
    proc.stdin.end();

    const exitCode = await proc.exited;
    const logContent = await readFile(logPath, "utf8");
    return { exitCode, logContent };
  }

  test("exits with error when no logfile provided", async () => {
    const proc = Bun.spawn(["bun", "run", "bin/clear-log.ts"], {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    expect(exitCode).not.toBe(0);
  });

  test("writes basic input to log file", async () => {
    const logPath = join(tempDir, "test.log");
    const input = "Hello, world!\n";

    const { exitCode, logContent } = await run(input, logPath);

    expect(exitCode).toBe(0);
    expect(logContent).toBe(input);
  });

  test("handles clear character by truncating file", async () => {
    const logPath = join(tempDir, "test.log");
    const clearChar = "\x0c"; // Control-L
    const input = `Before clear${clearChar}After clear\n`;

    const { exitCode, logContent } = await run(input, logPath);

    expect(exitCode).toBe(0);
    expect(logContent).toBe("After clear\n");
  });

  test("handles multiple clear characters", async () => {
    const logPath = join(tempDir, "test.log");
    const clearChar = "\x0c";
    const input = `First${clearChar}Second${clearChar}Third\n`;

    const { exitCode, logContent } = await run(input, logPath);

    expect(exitCode).toBe(0);
    expect(logContent).toBe("Third\n");
  });

  test("handles clear character at start of input", async () => {
    const logPath = join(tempDir, "test.log");
    const clearChar = "\x0c";
    const input = `${clearChar}Only content\n`;

    const { exitCode, logContent } = await run(input, logPath);

    expect(exitCode).toBe(0);
    expect(logContent).toBe("Only content\n");
  });

  test("handles clear character at end of input", async () => {
    const logPath = join(tempDir, "test.log");
    const clearChar = "\x0c";
    const input = `Content to clear${clearChar}`;

    const { exitCode, logContent } = await run(input, logPath);

    expect(exitCode).toBe(0);
    expect(logContent).toBe("");
  });

  test("handles empty input", async () => {
    const logPath = join(tempDir, "test.log");
    const input = "";

    const { exitCode, logContent } = await run(input, logPath);

    expect(exitCode).toBe(0);
    expect(logContent).toBe("");
  });

  test("handles consecutive clear characters", async () => {
    const logPath = join(tempDir, "test.log");
    const clearChar = "\x0c";
    const input = `Start${clearChar}${clearChar}${clearChar}End\n`;

    const { exitCode, logContent } = await run(input, logPath);

    expect(exitCode).toBe(0);
    expect(logContent).toBe("End\n");
  });
});
