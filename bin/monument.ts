import { parseArgs } from "util";
import path from "path";
import { mkdir } from "node:fs/promises";
import { glob } from "glob";
import ThingMananger from "../src/ThingManager";
import { openai } from "../src/models";
import { effect } from "signal-utils/subtle/microtask-effect";

async function main(argv: string[]) {
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
  const cwd = path.resolve(values["directory"]);
  const out = path.resolve(values["output-directory"]);

  await mkdir(out, { recursive: true });

  const monument = new ThingMananger(model);

  const files = await glob("**/*.md", {
    cwd: cwd,
    ignore: path.join(out, "**"),
  });

  for (const file of files) {
    const source = Bun.pathToFileURL(path.join(cwd, file));
    const target = Bun.pathToFileURL(path.join(out, file));
    const documentSignal = await monument.want(source);
    effect(() => {
      const doc = documentSignal.get();
      if (!doc) return;
      Bun.file(target.pathname).write(doc);
      console.log("*", target.pathname);
    });
  }
}

main(Bun.argv);
