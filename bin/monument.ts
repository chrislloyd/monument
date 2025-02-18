import { parseArgs } from "util";
import path from "path";
import { mkdir } from "node:fs/promises";
import { glob } from "glob";
import { Monument } from "../src/process-doc";
import { openai } from "../src/models";
import { effect } from "signal-utils/subtle/microtask-effect";
import { AsyncComputed } from "signal-utils/async-computed";

async function processFile(
  monument: Monument,
  filePath: string,
  outputDir: string,
  inputDir: string,
  values: Record<string, string | undefined>,
) {
  if (!filePath.endsWith(".md")) return;
  if (filePath.includes(outputDir)) return;

  const relativePath = path.relative(inputDir, filePath);
  const outputPath = path.join(outputDir, relativePath);

  const source = Bun.pathToFileURL(filePath);
  const doc = monument.start(source);

  const model = openai("gpt-4o-mini", values["OPENAI_API_KEY"]!);
  const ai = new AsyncComputed(async (signal) => {
    const value = doc.get();
    if (!value) return;

    let chunks = [];
    for await (const chunk of model.stream([value], signal)) {
      chunks.push(chunk);
    }
    return chunks.join("");
  });

  // Call out to
  effect(() => {
    const chunks = ai.get();
    if (!chunks) return;

    Bun.file(outputPath).write(chunks);
    console.log("*", outputPath);
  });
}

async function main(argv: string[]) {
  const monument = new Monument();

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

  const inputDir = path.resolve(values["directory"]);
  const outputDir = path.resolve(values["output-directory"]);

  await mkdir(outputDir, { recursive: true });

  const files = await glob("**/*.md", { cwd: inputDir });
  for (const file of files) {
    processFile(
      monument,
      path.join(inputDir, file),
      outputDir,
      inputDir,
      values,
    );
  }
}

main(Bun.argv);
