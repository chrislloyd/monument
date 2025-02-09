import { describe, expect, test, afterEach, beforeEach } from "bun:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("monument", () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await mkdtemp(join(tmpdir(), "transclude-test-"));
  });

  afterEach(async () => {
    // Clean up temporary directory after tests
    await rm(tempDir, { recursive: true });
  });

  async function tmpfile(content: string, extension: string = "md"): Promise<string> {
    const name = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${extension}`;
    const path = join(tempDir, name);
    await writeFile(path, content);
    return path;
  }

  async function run(...argv: string[]): Promise<unknown> {
    const proc = Bun.spawn(["bun", "run", "index.ts", ...argv]);
    const output = await new Response(proc.stdout).text();
    return JSON.parse(output.trim());
  }

  test("markdown without transclusions", async () => {
    const content = "# Hello\nThis is a test";
    const path = await tmpfile(content);
    const result = await run(path);
    expect(result).toMatchSnapshot()
  });

  test("single level transclusion", async () => {
    const innerContent = "## Inner Content\nThis is included content";
    const innerPath = await tmpfile(innerContent);
    const outerContent = `# Outer Content\n![include](${innerPath})`;
    const outerPath = await tmpfile(outerContent);

    const result = await run(outerPath);
    expect(result).toMatchSnapshot()
  });

  test("nested transclusions", async () => {
    const deepestContent = "### Deepest Content";
    const deepestPath = await tmpfile(deepestContent);
    const middleContent = `## Middle Content\n![include](${deepestPath})`;
    const middlePath = await tmpfile(middleContent);
    const outerContent = `# Outer Content\n![include](${middlePath})`;
    const outerPath = await tmpfile(outerContent);

    const result = await run(outerPath);
    expect(result).toMatchSnapshot()
  });

  test("multiple transclusions at same level", async () => {
    const content1 = "Content 1";
    const content2 = "Content 2";
    const path1 = await tmpfile(content1);
    const path2 = await tmpfile(content2);

    const mainContent = `Main\n![include](${path1})\nMiddle\n![include](${path2})\nEnd`;
    const mainPath = await tmpfile(mainContent);

    const result = await run(mainPath);
    expect(result).toMatchSnapshot()
  });

  test("keeps original markdown rendering fails", async () => {
    const content = "Start\n![include](missing.md)\nEnd";
    const path = await tmpfile(content);
    const result = await run(path);
    expect(result).toMatchSnapshot()
  });

  test("empty files", async () => {
    const emptyPath = await tmpfile("");

    const content = `Before\n![include](${emptyPath})\nAfter`;
    const path = await tmpfile(content);

    const result = await run(path);
    expect(result).toMatchSnapshot()
  });

  test("files with only whitespace", async () => {
    const whitespacePath = await tmpfile("   \n  \t  \n");

    const content = `Before\n![include](${whitespacePath})\nAfter`;
    const path = await tmpfile(content);

    const result = await run(path);
    expect(result).toMatchSnapshot()
  });

  test("preserves markdown formatting", async () => {
    const innerContent = "**bold** and *italic*";
    const innerPath = await tmpfile(innerContent);

    const outerContent = `# Title\n![include](${innerPath})\n## Subtitle`;
    const outerPath = await tmpfile(outerContent);

    const result = await run(outerPath);
    expect(result).toMatchSnapshot()
  });

  test("errors when input file doesn't exist", async () => {
    const proc = Bun.spawn(["bun", "run", "index.ts", "nonexistent.md"], {
      stderr: null,
    });
    const exitCode = await proc.exited;
    expect(exitCode).not.toBe(0);
  });

  test("http protocol", async () => {
    const port = 3000;
    const server = Bun.serve({
      port,
      fetch() {
        return new Response("World", { headers: { "content-type": "text/plain" } });
      }
    });
    const content = `Hello ![entity](http://localhost:${port})`;
    const path = await tmpfile(content);
    const result = await run(path);
    expect(result).toMatchSnapshot();
    server.stop();
  });

  test("html content type", async () => {
    const path = await tmpfile("<h1>Hello</h1>", "html");
    const result = await run(path);
    expect(result).toMatchSnapshot();
  });
});
