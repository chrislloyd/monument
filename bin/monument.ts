import { Run, type Status } from "../src/build";
import { MonotonicClock } from "../src/clock";
import { parse } from "../src/html";
import { BunLoader, Loader } from "../src/loader";
import { AnthropicModel, NoopModel } from "../src/model";
import { Resolver } from "../src/resolver";
import { RuleSet } from "../src/rule";
import { FileStorage } from "../src/storage";

async function main(argv: string[]) {
  const abortController = new AbortController();
  const clock = new MonotonicClock(Date.now());
  const loader = new BunLoader(new Loader());
  const ruleset = new RuleSet();

  // out/*.md -> out/*.hmd
  ruleset.file("**/out/*.md", async (context) => {
    const inputUrl = new URL(
      context.out.href.replace(/out\/([^/]+)\.md/, "$1.md"),
    );
    await context.need(inputUrl);

    const blob = await loader.load(inputUrl, context.signal);
    const body = await parse(blob);
    const hmd = { url: inputUrl.href, body };
    const resolver = new Resolver(loader, context.need);
    const mc = await resolver.resolve(hmd, context.signal);
    
    // Use NoopModel for testing
    const model = new NoopModel();
    // const apiKey = Bun.env["ANTHROPIC_API_KEY"];
    // const model = apiKey 
    //   ? new AnthropicModel("claude-3-5-sonnet-20241022", apiKey)
    //   : new NoopModel();
    
    const chunks = await Array.fromAsync(model.stream(mc, context.signal));

    await Bun.write(context.out.pathname, chunks.join(""));
  });

  // Handle HTTP/HTTPS URLs
  ruleset.rule({
    predicate: (url) => url.protocol === "http:" || url.protocol === "https:",
    async fn(context) {
      // For HTTP URLs, we don't need to do anything - the loader will fetch them
      // and return the content as-is
      return JSON.stringify({ type: "http-resource" });
    },
  });

  ruleset.file("**", async () => {});

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
