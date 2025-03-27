import { Run, type Status } from "./build";
import { MonotonicClock } from "./clock";
import { parse } from "./html";
import markdown from "./markdown";
import { OpenAiModel } from "./model";
import { Resolver } from "./resolver";
import { RuleSet } from "./rule";
import { FileStorage } from "./storage";
import { Loader } from "./loader";

async function main(argv: string[]) {
  const abortController = new AbortController();
  const clock = new MonotonicClock(Date.now());
  const loader = new Loader();
  const ruleset = new RuleSet();

  // out/*.md -> out/*.hmd
  ruleset.file("**/out/*.md", async (context) => {
    const input = new URL(
      context.out.href.replace(/out\/([^/]+)\.md/, "$1.md"),
    );
    await context.need(input);

    const md = await loader.load(input, context.signal);

    const html = markdown(await md.text());
    const hmd = parse(input.href, html);

    const resolver = new Resolver(loader, context.need);

    const mc = await resolver.resolve(hmd, context.signal);
    const model = new OpenAiModel("gpt-4o-mini", Bun.env["OPENAI_API_KEY"]!);
    const chunks = await Array.fromAsync(model.stream(mc, context.signal));

    await Bun.write(context.out, chunks.join(""));
  });

  // --

  const db = Bun.file("db.json");
  if (await db.exists()) await db.delete();

  const path = argv[2];
  if (!path) throw new Error();

  const storage = new FileStorage<Status>("db.json");
  await storage.create();

  const run = new Run(clock, ruleset.action(), storage, abortController.signal);
  const url = Bun.pathToFileURL(path);
  await run.need(url);

  console.log(await Bun.file(url).text());
}

await main(Bun.argv);
