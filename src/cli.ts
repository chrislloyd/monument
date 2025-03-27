import { Run, type Status } from "./build";
import { MonotonicClock } from "./clock";
import { hypertext } from "./hypertext";
import markdown from "./markdown";
import { mcFromHmc, OpenAiModel } from "./model";
import { Rules } from "./rule";
import { FileStorage } from "./storage";

const rules = new Rules();

// out/*.md -> *.html
rules.rule({
  predicate: (path) => !!path.match(/out\/[^.]+\.md/),
  async fn(context) {
    const input = context.out.replace(/out\/([^/]+)\.md/, "$1.html");
    const html = (await context.need(input)) as string;

    // De-hyperize the model context
    const hmc = hypertext(html);
    const mc = await mcFromHmc(hmc, context.need);

    const model = new OpenAiModel("gpt-4o-mini", Bun.env["OPENAI_API_KEY"]!);

    // TODO: This signal should be passed in via. context
    const abortController = new AbortController();
    const chunks = await Array.fromAsync(
      model.stream(mc, abortController.signal),
    );
    return chunks.join("");
  },
});

// *.html -> *.md
rules.rule({
  predicate: (path) => !!path.match(/[^.]+\.html/),
  async fn(context) {
    const mdpath = context.out.replace(/([^/]+)\.html/, "$1.md");
    const input = (await context.need(mdpath)) as string;
    return markdown(input);
  },
});

// *
rules.rule({
  predicate: (path) => true,
  async fn(context) {
    const text = await Bun.file(context.out).text();
    return text;
  },
});

async function main(argv: string[]) {
  const db = Bun.file("db.json");
  if (await db.exists()) await db.delete();

  const path = argv[2];
  if (!path) throw new Error();

  const clock = new MonotonicClock();
  const storage = new FileStorage<Status>("db.json");
  await storage.create();
  const run = new Run(clock, rules.action(), storage);

  const out = await run.need(path);

  console.log(out);
}

await main(Bun.argv);
