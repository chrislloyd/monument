/**
 * Tiny Build System
 */

// Identifies a value
type Id = string;
// Represents a value. This has to be runtime typechecked and serializable.
type Value = unknown;
// A monotonically increasing identifier for each build run
type RunId = ReturnType<typeof Date.now>;

// The result of a build, along with the full list of dependencies. built and
// changed help to determine if the result is still valid.
type Result = {
  value: Value;
  built: RunId;
  changed: RunId;
  depends: Id[][];
};

enum StatusType {
  LOADED,
  RUNNING,
  FAILED,
  READY,
}

// The current status of a key.
type Status =
  | { type: StatusType.LOADED; result: Result }
  | { type: StatusType.RUNNING; promise: Promise<Result> }
  | { type: StatusType.FAILED; error: unknown }
  | { type: StatusType.READY; result: Result };

type Database = Map<Id, Status>;

function get(
  database: Database,
  key: Id,
): (Status & { type: StatusType.READY }) | null {
  const status = database.get(key);
  if (status?.type !== StatusType.READY) {
    return null;
  }
  return status;
}

// --

export type ActionContext = {
  out: Id;
  need(dep: Id): Promise<Value>;
  needN(deps: Id[]): Promise<Value[]>;
};
export type Action = (context: ActionContext) => Promise<Value>;

// --

export class Run {
  #id: RunId = Date.now();

  constructor(
    private readonly action: Action,
    private database: Database,
  ) {}

  async need(key: Id): Promise<Value> {
    const status = this.database.get(key);

    if (!status) {
      return await this.#build(key);
    }

    switch (status.type) {
      case StatusType.LOADED: {
        return await this.#build(key);
      }

      case StatusType.RUNNING: {
        const result = await status.promise;
        return result.value;
      }

      case StatusType.FAILED:
        throw status.error;

      case StatusType.READY:
        if (this.#isValid(key)) {
          return status.result.value;
        } else {
          return await this.#build(key);
        }

      default:
        throw new Error(`Unexpected status: ${status}`);
    }
  }

  async needN(keys: Id[]): Promise<Value[]> {
    return await Promise.all(keys.map((key) => this.need(key)));
  }

  async #build(key: Id): Promise<Value> {
    try {
      const promise = this.#run(key);
      this.database.set(key, { type: StatusType.RUNNING, promise });
      const result = await promise;
      this.database.set(key, { type: StatusType.READY, result });
      return result.value;
    } catch (error) {
      this.database.set(key, { type: StatusType.FAILED, error });
      throw error;
    }
  }

  async #run(key: Id): Promise<Result> {
    const depends: Id[][] = [];
    const context = {
      out: key,
      need: async (dep: Id) => {
        depends.push([dep]);
        return this.need(dep);
      },
      needN: async (deps: Id[]) => {
        depends.push(deps);
        return this.needN(deps);
      },
    };

    const prevStatus = this.database.get(key);

    const value = await this.action(context);

    let changed = this.#id;
    if (
      prevStatus &&
      prevStatus.type === StatusType.READY &&
      !Run.#hasChanged(prevStatus.result.value, value)
    ) {
      changed = prevStatus.result.changed;
    }

    return {
      value,
      built: this.#id,
      changed,
      depends,
    };
  }

  static #hasChanged(prev: Value, next: Value): boolean {
    return JSON.stringify(prev) !== JSON.stringify(next);
  }

  #isValid(key: Id): boolean {
    const status = get(this.database, key);
    if (!status) {
      return false;
    }
    const result = status.result;
    return result.depends
      .flatMap((deps) => deps)
      .every((dep) => {
        const depStatus = get(this.database, dep);
        return depStatus && result.changed >= depStatus.result.built;
      });
  }
}

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
      for (let { pattern, fn } of this.#rules) {
        if (out.match(pattern)) {
          return await fn(context);
        }
      }
      throw new Error(`No rule matches for "${out}"`);
    };
  }
}
