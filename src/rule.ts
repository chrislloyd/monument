import type { Id, Action } from "./build";

type Predicate<T> = (value: T) => boolean;

export type Rule = { predicate: Predicate<Id>; fn: Action };

export class Rules {
  #rules: Rule[] = [];

  rule(rule: Rule): void {
    this.#rules.push(rule);
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
