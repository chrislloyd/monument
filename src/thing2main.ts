import { type Action, Run, Rules, type Rule } from "./build/thing3";
import assert from "node:assert/strict";

const file = (pattern: string, fn: Action): Rule => {
  return {
    pattern,
    fn: async (ctx) => {
      const content = await fn(ctx);
      assert(typeof content === "string");
      Bun.write(String(ctx.out), content);
      return Date.now();
    },
  };
};

const rules = new Rules();

rules.rule(
  file("foo.txt", async ({ out, need }) => {
    const value = "foo";
    const dep = "hello.txt";
    const depValue = await need(dep);
    return `${out} = ${value}\n${dep} = ${String(depValue).toUpperCase()}`;
  }),
);

rules.rule(file("hello.txt", async () => "hello world"));

const run = new Run(rules.action(), new Map());
const foo = await run.need("foo.txt");
console.log(foo);

// await foo((actionContext) => {
//   actionContext.action(async (ruleContext) => {
//     ruleContext.need("foo.txt");
//     ruleContext.shell`foo ${asdf}`;
//   });
// };
