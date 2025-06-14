import type { Action, ActionContext } from "./build";

type Predicate<T> = (value: T) => boolean;

export type Rule = { predicate: Predicate<URL>; fn: Action };

export class RuleSet {
  #rules: Rule[] = [];

  rule(rule: Rule): void {
    this.#rules.push(rule);
  }

  file(glob: string, action: (context: ActionContext) => Promise<void>) {
    this.rule({
      predicate: (url) => new Bun.Glob(glob).match(url.pathname),
      async fn(context) {
        await action(context);

        const file = Bun.file(context.out.pathname);
        if (!(await file.exists())) {
          throw new Error(`Rule did not create file "${context.out}"`);
        }
        const stat = await file.stat();
        return JSON.stringify({ mtimeMs: stat.mtimeMs });
      },
    });
  }

  action(): Action {
    return async (context) => {
      const { out } = context;
      for (let { predicate, fn } of this.#rules) {
        if (predicate(out)) {
          return await fn(context);
        }
      }
      throw new Error(`No rule matches for "${out}"`);
    };
  }
}
