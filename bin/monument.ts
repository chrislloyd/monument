import { parseArgs } from "util";
import path from "path";
import { mkdir } from "node:fs/promises";
import { glob } from "glob";
import { Monument } from "../src/process-doc";
import { openai, type Model } from "../src/models";
import { effect } from "signal-utils/subtle/microtask-effect";
import { AsyncComputed } from "signal-utils/async-computed";

async function processFile(
  monument: Monument,
  filePath: string,
  outputDir: string,
  inputDir: string,
  model: Model,
) {
  const relativePath = path.relative(inputDir, filePath);
  const outputPath = path.join(outputDir, relativePath);

  const source = Bun.pathToFileURL(filePath);
  const doc = monument.start(source);

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
        required: true,
      },
      "output-directory": {
        type: "string",
        required: true,
      },
      "api-key": {
        type: "string",
        default: process.env["OPENAI_API_KEY"],
        required: true,
      },
      model: {
        type: "string",
        default: "gpt-4o-mini",
        required: true,
      },
    },
    strict: true,
    allowPositionals: true,
  });

  if (!values["output-directory"]) {
    console.error("Error: --output-directory is required");
    process.exit(1);
  }

  if (!values["api-key"]) {
    console.error("Error: --api-key is required");
    process.exit(1);
  }

  const model = openai(values["model"], values["api-key"]);
  const inputDir = path.resolve(values["directory"]);
  const outputDir = path.resolve(values["output-directory"]);

  await mkdir(outputDir, { recursive: true });

  const files = await glob("**/*.md", {
    cwd: inputDir,
    ignore: path.join(outputDir, "**"),
  });

  for (const file of files) {
    processFile(
      monument,
      path.join(inputDir, file),
      outputDir,
      inputDir,
      model,
    );
  }
}

main(Bun.argv);
