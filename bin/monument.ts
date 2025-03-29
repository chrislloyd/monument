import { Run, type Status } from "../src/build";
import { MonotonicClock } from "../src/clock";
import { parse } from "../src/html";
import { markdown } from "../src/markdown";
import { OpenAiModel } from "../src/model";
import { Resolver } from "../src/resolver";
import { RuleSet } from "../src/rule";
import { FileStorage } from "../src/storage";
import { Loader } from "../src/loader";

async function main(argv: string[]) {
  const abortController = new AbortController();
  const clock = new MonotonicClock(Date.now());
  const loader = new Loader();
  const ruleset = new RuleSet();

  // out/*.md -> out/*.hmd
  ruleset.file("**/out/*.md", async (context) => {
    const inputUrl = new URL(
      context.out.href.replace(/out\/([^/]+)\.md/, "$1.md"),
    );
    await context.need(inputUrl);

    const md = await loader.load(inputUrl, context.signal);
    const text = await md.text();
    const hmd = { url: inputUrl.href, body: parse(text) };
    const resolver = new Resolver(loader, context.need);
    const mc = await resolver.resolve(hmd, context.signal);
    const model = new OpenAiModel("gpt-4o-mini", Bun.env["OPENAI_API_KEY"]!);
    const chunks = await Array.fromAsync(model.stream(mc, context.signal));

    await Bun.write(context.out, chunks.join(""));
  });

  ruleset.file("**", () => {});

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
