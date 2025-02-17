/**
 * This is hacked together from my existing scripts, it's not ideal.
 */
import { parseArgs } from "util";
import { watch } from "node:fs/promises";
import { spawn } from "child_process";
import path from "path";
import { mkdir } from "node:fs/promises";
import { glob } from "glob";
import { Monument } from "../src/process-doc";
import { Scope, type Signal } from "../src/signals";

function processDoc(
  scope: Scope,
  filePath: string,
): Signal<string | undefined> {
  const monument = new Monument(scope);
  const source = Bun.pathToFileURL(filePath);
  const doc = monument.start(source);
  return doc;
}

async function processFile(
  filePath: string,
  outputDir: string,
  inputDir: string,
  values: Record<string, string | undefined>,
) {
  const scope = new Scope();

  if (!filePath.endsWith(".md")) return;
  if (filePath.includes(outputDir)) return;

  const relativePath = path.relative(inputDir, filePath);
  const outputPath = path.join(outputDir, relativePath);

  // Create temp file path for process-doc output
  const tempPath = Bun.file(path.join(outputDir, `${relativePath}.txt`));

  // Create pipeline: process-doc -> watch-ai -> clear-log
  const doc = processDoc(scope, filePath);

  // Pipe processDoc to `clear-log(1)`
  scope.effect(() => {
    const value = doc.get();
    if (!value) {
      return;
    }
    tempPath.write(value);
  });

  const watchAi = spawn(
    "bun",
    [
      "src/watch-ai.ts",
      "--apiKey",
      values["api-key"]!,
      "--model",
      values["model"]!,
      "--debounce",
      values["debounce"]!,
      tempPath.name!,
    ],
    { stdio: ["ignore", "pipe", "inherit"] },
  );
  const aiClearLog = spawn("bun", ["src/clear-log.ts", outputPath], {
    stdio: ["pipe", "ignore", "inherit"],
  });
  watchAi.stdout.pipe(aiClearLog.stdin);

  // Handle process errors
  watchAi.on("error", console.error);
  aiClearLog.on("error", console.error);
}

async function main(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      directory: {
        type: "string",
        default: ".",
      },
      "output-directory": {
        type: "string",
        required: true,
      },
      "api-key": {
        type: "string",
        default: process.env["OPENAI_API_KEY"],
      },
      model: {
        type: "string",
        default: "gpt-4-turbo-preview",
      },
      debounce: {
        type: "string",
        default: "300",
      },
    },
    strict: true,
    allowPositionals: true,
  });

  if (!values["output-directory"]) {
    console.error("Error: --output-directory is required");
    process.exit(1);
  }

  // Watch for markdown files in the input directory
  const inputDir = path.resolve(values["directory"]);
  const outputDir = path.resolve(values["output-directory"]);

  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  // Initial processing of existing files
  const files = await glob("**/*.md", { cwd: inputDir });
  for (const file of files) {
    processFile(path.join(inputDir, file), outputDir, inputDir, values);
  }

  // Watch for changes
  for await (const event of watch(inputDir, { recursive: true })) {
    if (event.filename) {
      if (event.filename.includes(outputDir)) {
        continue;
      }
      const filePath = path.join(inputDir, event.filename);
      processFile(filePath, outputDir, inputDir, values);
    }
  }
}

main(Bun.argv);
