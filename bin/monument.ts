/**
 * This is hacked together from my existing scripts, it's not ideal.
 */
import { parseArgs } from "util";
import { watch } from "node:fs/promises";
import { spawn } from "child_process";
import path from "path";
import { mkdir } from "node:fs/promises";
import { glob } from "glob";

async function processFile(
  filePath: string,
  outputDir: string,
  inputDir: string,
  values: Record<string, string | undefined>,
) {
  if (!filePath.endsWith(".md")) return;
  if (filePath.includes(outputDir)) return;

  console.error("Processing", filePath);

  const relativePath = path.relative(inputDir, filePath);
  const outputPath = path.join(outputDir, relativePath);

  // Create temp file path for process-doc output
  const tempPath = path.join(outputDir, `${relativePath}.txt`);

  // Create pipeline: process-doc -> watch-ai -> clear-log
  const processDoc = spawn("bun", ["src/process-doc.ts", filePath], {
    stdio: ["ignore", "pipe", "ignore"],
  });
  const docClearLog = spawn("bun", ["src/clear-log.ts", tempPath], {
    stdio: ["pipe", "ignore", "ignore"],
  });
  processDoc.stdout.pipe(docClearLog.stdin);

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
      tempPath,
    ],
    { stdio: ["ignore", "pipe", "ignore"] },
  );
  const aiClearLog = spawn("bun", ["src/clear-log.ts", outputPath], {
    stdio: ["pipe", "ignore", "ignore"],
  });
  watchAi.stdout.pipe(aiClearLog.stdin);

  // Handle process errors
  processDoc.on("error", console.error);
  docClearLog.on("error", console.error);
  watchAi.on("error", console.error);
  aiClearLog.on("error", console.error);

  await new Promise((resolve) => {
    processDoc.on("exit", resolve);
  });
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

  // Ensure output directory exists
  await mkdir(values["output-directory"], { recursive: true });

  // Watch for markdown files in the input directory
  const inputDir = path.resolve(values.directory ?? ".");
  const outputDir = path.resolve(values["output-directory"]);

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
