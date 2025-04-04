import { type Clock } from "./clock";
import { type Storage } from "./storage";

// A monotonically increasing identifier for each build run
type RunId = ReturnType<Clock["now"]>;

type Id = string;

function urlFromId(id: Id): URL {
  return new URL(id);
}

function idFromUrl(url: URL): Id {
  return url.href;
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
  | { type: StatusType.RUNNING }
  | { type: StatusType.FAILED; error: unknown }
  | { type: StatusType.READY; result: Result };

async function getWhereReady(
  database: Storage<Status>,
  id: Id,
): Promise<(Status & { type: StatusType.READY }) | undefined> {
  const url = urlFromId(id);
  const status = await database.get(url);
  if (status?.type !== StatusType.READY) {
    return undefined;
  }
  return status;
}

// --

export type ActionContext = {
  out: URL;
  need(dep: URL): Promise<void>;
  needN(deps: URL[]): Promise<void>;
  signal: AbortSignal;
};

export type Action = (context: ActionContext) => Promise<unknown>;

// --

export class Run {
  private readonly id: RunId;
  #action: Action;
  #database: Storage<Status>;
  #signal: AbortSignal;
  #running: Map<Id, Promise<Result>> = new Map();

  constructor(
    clock: Clock,
    action: Action,
    database: Storage<Status>,
    signal: AbortSignal,
  ) {
    this.id = clock.now();
    this.#action = action;
    this.#database = database;
    this.#signal = signal;
  }

  async need(url: URL): Promise<Value> {
    const id = idFromUrl(url);

    if (this.#running.has(id)) {
      const result = await this.#running.get(id);
      return result?.value;
    }

    const status = await this.#database.get(urlFromId(id));

    if (!status) {
      return await this.#build(id);
    }

    switch (status.type) {
      case StatusType.LOADED: {
        return await this.#build(id);
      }

      case StatusType.RUNNING: {
        return await this.#running.get(id);
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

  async needN(keys: URL[]): Promise<Value[]> {
    return await Promise.all(keys.map((key) => this.need(key)));
  }

  async #build(id: Id): Promise<Value> {
    const url = urlFromId(id);
    try {
      const promise = this.#run(id);
      this.#running.set(id, promise);
      await this.#database.put(url, { type: StatusType.RUNNING });
      const result = await promise;
      await this.#database.put(url, { type: StatusType.READY, result });
      return result.value;
    } catch (error) {
      await this.#database.put(url, { type: StatusType.FAILED, error });
      throw error;
    } finally {
      this.#running.delete(id);
    }
  }

  async #run(id: Id): Promise<Result> {
    const depends: Id[][] = [];
    const context: ActionContext = {
      out: urlFromId(id),
      need: async (dep: URL) => {
        const depId = idFromUrl(dep);
        if (id === depId) {
          throw new Error(`Self-dependency: ${id} depeneds on itself`);
        }
        depends.push([depId]);
        await this.need(dep);
      },
      needN: async (deps: URL[]) => {
        const depIds = deps.map((dep) => idFromUrl(dep));
        if (depIds.some((depId) => id === depId)) {
          throw new Error(`Self-dependency: ${id} depeneds on itself`);
        }
        depends.push(depIds);
        await this.needN(deps);
      },
      signal: this.#signal,
    };

    const url = urlFromId(id);
    const prevStatus = await this.#database.get(url);

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
