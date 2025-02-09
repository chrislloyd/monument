import { describe, expect, test, beforeEach, afterEach, mock } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import OpenAI from "openai";

// Add OpenAI to global scope for testing
declare global {
  var OpenAI: any;
}

describe("watch-ai", () => {
  let tempDir: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "watch-ai-test-"));
    originalEnv = { ...process.env };
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
    process.env = originalEnv;
  });

  async function tmpfile(content: string): Promise<string> {
    const name = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.txt`;
    const path = join(tempDir, name);
    await writeFile(path, content);
    return path;
  }

  async function run(path: string, options: string[] = []): Promise<{ stdout: string, exitCode: number }> {
    const proc = Bun.spawn(["bun", "run", "bin/watch-ai.ts", ...options, path], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    return { stdout, exitCode };
  }

  test("exits with error when no path provided", async () => {
    const proc = Bun.spawn(["bun", "run", "bin/watch-ai.ts"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    expect(exitCode).not.toBe(0);
  });

  test("accepts custom API key", async () => {
    const path = await tmpfile("test content");
    const customKey = "custom-test-key";
    const { exitCode } = await run(path, ["--apiKey", customKey]);
    expect(exitCode).toBe(0);
  });

  test("accepts custom model", async () => {
    const path = await tmpfile("test content");
    const { exitCode } = await run(path, ["--model", "gpt-4"]);
    expect(exitCode).toBe(0);
  });

  test("accepts custom debounce time", async () => {
    const path = await tmpfile("test content");
    const { exitCode } = await run(path, ["--debounce", "500"]);
    expect(exitCode).toBe(0);
  });

  test("handles file updates", async () => {
    const path = await tmpfile("initial content");
    const mockOpenAI = mock(() => ({
      chat: {
        completions: {
          create: async () => ({
            choices: [{ delta: { content: "response" } }]
          })
        }
      }
    }));

    // Mock OpenAI class
    global.OpenAI = mockOpenAI;

    const proc = run(path);

    // Update file content
    await writeFile(path, "updated content");

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 400));

    expect(mockOpenAI).toHaveBeenCalled();
  });

  test("debounces multiple rapid updates", async () => {
    const path = await tmpfile("initial content");
    let callCount = 0;

    const mockOpenAI = mock(() => ({
      chat: {
        completions: {
          create: async () => {
            callCount++;
            return { choices: [{ delta: { content: "response" } }] };
          }
        }
      }
    }));

    global.OpenAI = mockOpenAI;

    const proc = run(path);

    // Multiple rapid updates
    await writeFile(path, "update 1");
    await writeFile(path, "update 2");
    await writeFile(path, "update 3");

    // Wait for debounce
    await new Promise(resolve => setTimeout(resolve, 400));

    expect(callCount).toBe(1); // Should only call once due to debouncing
  });
});
