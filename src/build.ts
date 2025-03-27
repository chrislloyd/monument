/**
 * Tiny Build System
 */
import { type Clock } from "./clock";
import { type Reference } from "./reference";
import { type Storage } from "./storage";

// A monotonically increasing identifier for each build run
type RunId = ReturnType<Clock["now"]>;

export type Id = string;

function referenceFromId(id: Id): Reference {
  const [protocol = "", path = ""] = id.split(":", 2);
  return { protocol, path };
}

type Value = unknown;

// The result of a build, along with the full list of dependencies. built and
// changed help to determine if the result is still valid.
type Result = {
  value: Value; // This has to be runtime typechecked and serializable.
  built: number;
  changed: number;
  depends: Id[][];
};

enum StatusType {
  LOADED,
  RUNNING,
  FAILED,
  READY,
}

// The current status of a key.
export type Status =
  | { type: StatusType.LOADED; result: Result }
  | { type: StatusType.RUNNING; promise: Promise<Result> }
  | { type: StatusType.FAILED; error: unknown }
  | { type: StatusType.READY; result: Result };

async function getWhereReady(
  database: Storage<Status>,
  id: Id,
): Promise<(Status & { type: StatusType.READY }) | undefined> {
  const ref = referenceFromId(id);
  const status = await database.get(ref);
  if (status?.type !== StatusType.READY) {
    return undefined;
  }
  return status;
}

// --

type ActionContext = {
  out: Id;
  need(dep: Id): Promise<unknown>;
  needN(deps: Id[]): Promise<unknown[]>;
};

export type Action = (context: ActionContext) => Promise<unknown>;

// --

export class Run {
  private readonly id: RunId;
  #action: Action;
  #database: Storage<Status>;

  constructor(clock: Clock, action: Action, database: Storage<Status>) {
    this.id = clock.now();
    this.#action = action;
    this.#database = database;
  }

  async need(id: Id): Promise<Value> {
    const status = await this.#database.get(referenceFromId(id));

    if (!status) {
      return await this.#build(id);
    }

    switch (status.type) {
      case StatusType.LOADED: {
        return await this.#build(id);
      }

      case StatusType.RUNNING: {
        const result = await status.promise;
        return result.value;
      }

      case StatusType.FAILED:
        throw status.error;

      case StatusType.READY:
        if (await this.#isValid(id)) {
          return status.result.value;
        } else {
          return await this.#build(id);
        }

      default:
        throw new Error(`Unexpected status: ${status}`);
    }
  }

  async needN(keys: Id[]): Promise<Value[]> {
    return await Promise.all(keys.map((key) => this.need(key)));
  }

  async #build(id: Id): Promise<Value> {
    const ref = referenceFromId(id);
    try {
      const promise = this.#run(id);
      await this.#database.put(ref, { type: StatusType.RUNNING, promise });
      const result = await promise;
      await this.#database.put(ref, { type: StatusType.READY, result });
      return result.value;
    } catch (error) {
      await this.#database.put(ref, { type: StatusType.FAILED, error });
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

    const ref = referenceFromId(key);
    const prevStatus = await this.#database.get(ref);

    const value = await this.#action(context);

    let changed = this.id;
    if (
      prevStatus &&
      prevStatus.type === StatusType.READY &&
      !Run.#hasChanged(prevStatus.result.value, value)
    ) {
      changed = prevStatus.result.changed;
    }

    return {
      value,
      built: this.id,
      changed,
      depends,
    };
  }

  static #hasChanged(prev: Value, next: Value): boolean {
    return JSON.stringify(prev) !== JSON.stringify(next);
  }

  async #isValid(key: Id): Promise<boolean> {
    const status = await getWhereReady(this.#database, key);
    if (!status) {
      return false;
    }
    const depStatuses = await Promise.all(
      status.result.depends
        .flatMap((deps) => deps)
        .map((dep) => getWhereReady(this.#database, dep)),
    );
    return depStatuses.every(
      (depStatus) =>
        depStatus && status.result.changed >= depStatus.result.built,
    );
  }
}
