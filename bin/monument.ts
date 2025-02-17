import { parseArgs } from "util";
import path from "path";
import { mkdir } from "node:fs/promises";
import { glob } from "glob";
import { Monument } from "../src/process-doc";
import { Scope } from "../src/signals";
import { openai } from "../src/ai";

async function processFile(
  scope: Scope,
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

  const tempPath = Bun.file(path.join(outputDir, `${relativePath}.txt`));

  const source = Bun.pathToFileURL(filePath);
  const doc = monument.start(source);

  // Write out formatted markdown
  scope.effect(() => {
    const value = doc.get();
    if (!value) return;
    tempPath.write(value);
  });

  // Call out to
  scope.effect(() => {
    const value = doc.get();
    if (!value) return;
    const model = openai("gpt-4o-mini", values["OPENAI_API_KEY"]!);
    const abortController = new AbortController();
    (async () => {
      const abortSignal = abortController.signal;
      let chunks = [];
      for await (const chunk of model.stream([value], abortSignal)) {
        chunks.push(chunk);
      }
      Bun.file(outputPath).write(chunks.join(""));
      console.log("*", outputPath);
    })();
  });
}

async function main(argv: string[]) {
  const scope = new Scope();
  const monument = new Monument(scope);

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
      scope,
      monument,
      path.join(inputDir, file),
      outputDir,
      inputDir,
      values,
    );
  }
}

main(Bun.argv);
