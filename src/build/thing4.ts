import assert from "node:assert/strict";

// State

type Id = string;
type BuildId = number;
type Value = unknown;

type Result<K, V> = {
  value: V;
  built: BuildId;
  changed: BuildId;
  depends: K[][];
};

type Status<K, V> =
  | { type: "Loaded"; result: Result<K, V> }
  | { type: "Running"; promise: Promise<Result<K, V>> }
  | { type: "Failed"; error: unknown }
  | { type: "Ready"; result: Result<K, V> };

type State<K, V> = Map<K, Status<K, V>>;

// type Database = (key: Id) => Result<V>;

// async function load(path: string): Promise<State> {
//   const file = Bun.file(path);
//   const exists = await file.exists();
//   if (!exists) {
//     return new Map();
//   }
//   const json = await file.json();
//   return new Map(json);
// }

// async function save(path: string, state: State): Promise<void> {
//   await Bun.write(path, JSON.stringify(Array.from(state.entries())));
// }

// ---

type ActionContext<K, V> = {
  out: K;
  need(dep: K): Promise<V>;
};

type Action<K, V> = (context: ActionContext<K, V>) => Promise<V>;

type Akshun = () => Promise<void>;

class Akshun {
  constructor(private fn: (ctx: { out: string, need: Function }) => Promise<void>) {}
  call() { };
}

class Rules {
  private _akshuns: Akshun = [];
  action(fn) {
    this._akshuns.push(new Akshun(fn));
  }

  want(...rules: string[]) {
    for (const rule of rules) {
      this.action(({ need }) => need(rule)));
    }
  }
}

function makeBuildSystem(fn: (build: Rules) => void) {
  const rules = new Rules();
  fn.call(rules);
}

makeBuildSystem((build) {
  build.action(({ out, need }) => {
    need("file.txt");
  });


});

class BuildSystem<K, V> {
  private _akshun: Akshun = () => {};

  constructor(private state: State<K, V>) {}

  async want(...keys: K[]): Promise<void> {
    this._akshun = async () => {
      await Promise.all(keys.map((key) => this.need(key)));
    };
  }

  async need(key: K): Promise<V> {
    const status = this.state.get(key);

    if (!status) {
      return await this.build(key);
    }

    switch (status.type) {
      case "Loaded": {
        return await this.build(key);
      }

      case "Running": {
        const result = await status.promise;
        return result.value;
      }

      case "Failed":
        throw status.error;

      case "Ready":
        return status.result.value;
    }
  }

  invalidate(key: K): boolean {
    return this.state.delete(key);
  }

  private async build(key: K): Promise<V> {
    try {
      const buildPromise = this.run(key);
      this.state.set(key, { type: "Running", promise: buildPromise });
      const result = await buildPromise;
      this.state.set(key, { type: "Ready", result });
      return result.value;
    } catch (error) {
      this.state.set(key, { type: "Failed", error });
      throw error;
    }
  }

  private async run(out: K): Promise<Result<K, V>> {
    const depends: K[][] = [];
    const context: ActionContext<K, V> = {
      out,
      need: async (dep: K) => {
        console.log(out, "needing", dep);
        const depend = [dep];
        depends.push(depend);
        return this.need(dep);
      },
    };

    const value = await this.action(context);
    const now = Date.now();
    console.log(depends);
    return {
      value: value,
      built: now,
      changed: now,
      depends,
    };
  }
}

// ---

// function valid<V>(db: Database, key: Id, value: V): boolean {
//   const result = db(key);
//   return (
//     value === result.value &&
//     result.depends
//       .flatMap((deps) => deps)
//       .every((dep) => result.built >= db(dep).changed)
//   );
// }

// ---

async function main() {
  performance.mark("start");

  const filerule = <K, V>(fn: Action<K, V>): Action<K, V> => {
    return async (ctx) => {
      const content = await fn(ctx);
      assert(typeof content === "string");
      Bun.write(String(ctx.out), content);
      return Date.now() as V;
    };
  };

  const b = new BuildSystem(new Map(), (ctx) => {
    const { out } = ctx;
    let rule: Action<Id, Value> | undefined;
    switch (out) {
      case "foo.txt":
        rule = filerule(async ({ need }) => {
          const value = "foo";
          const dep = "hello.txt";
          const depValue = await need(dep);
          return `${out} = ${value}\n${dep} = ${String(depValue).toUpperCase()}`;
        });
        break;

      case "hello.txt":
        rule = filerule<Id, Value>(async () => "hello world");
        break;

      default:
        throw new Error();
    }
    if (!rule) {
      throw new Error();
    }
    return rule(ctx);
  });

  const value1 = await b.want("foo.txt");

  performance.mark("value1");
  console.log(
    "value1",
    value1,
    performance.measure("value1", "start", "value1").duration,
  );
}

await main();
