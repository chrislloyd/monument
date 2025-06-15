import { type Clock, type Instant } from "./clock";
import { type Storage } from "./storage";

// A monotonically increasing identifier for each build run
type RunId = Instant;

type Id = string;

type Value = unknown;

// The result of a build, along with the full list of dependencies. built and
// changed help to determine if the result is still valid.
type Result = {
  value: Value; // This has to be runtime typechecked and serializable.
  built: Instant;
  changed: Instant;
  depends: Id[][];
};

export enum StatusType {
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

export type ActionContext = {
  out: URL;
  need(dep: URL): Promise<void>;
  needN(deps: URL[]): Promise<void>;
  signal: AbortSignal;
};

export type Action = (context: ActionContext) => Promise<unknown>;

// --

function idFromUrl(url: URL): Id {
  return url.href;
}

async function getWhereReady(
  database: Storage<Status>,
  id: Id,
): Promise<(Status & { type: StatusType.READY }) | undefined> {
  const status = await database.get(id);
  if (status?.type !== StatusType.READY) {
    return undefined;
  }
  return status;
}

export class Run {
  private readonly id: RunId;
  #action: Action;
  #database: Storage<Status>;
  #signal: AbortSignal;
  #running: Map<Id, Promise<Value>> = new Map();

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
      return await this.#running.get(id);
    }

    const status = await this.#database.get(id);

    if (!status) {
      return await this.#build(url, undefined);
    }

    switch (status.type) {
      case StatusType.LOADED: {
        return await this.#build(url, status);
      }

      case StatusType.RUNNING: {
        return await this.#running.get(id);
      }

      case StatusType.FAILED:
        throw status.error;

      case StatusType.READY:
        if (await this.#isValid(status)) {
          return status.result.value;
        } else {
          return await this.#build(url, status);
        }

      default:
        throw new Error(`Unexpected status: ${status}`);
    }
  }

  async needN(keys: URL[]): Promise<Value[]> {
    return await Promise.all(keys.map((key) => this.need(key)));
  }

  async #build(url: URL, prevStatus: Status | undefined): Promise<Value> {
    const id = idFromUrl(url);
    try {
      // Before
      const depends: Id[][] = [];
      const context: ActionContext = {
        out: url,
        need: async (dep: URL) => {
          const depId = idFromUrl(dep);
          if (id === depId) {
            throw new Error(`Self-dependency: ${id} depends on itself`);
          }
          depends.push([depId]);
          await this.need(dep);
        },
        needN: async (deps: URL[]) => {
          const depIds = deps.map((dep) => idFromUrl(dep));
          if (depIds.some((depId) => id === depId)) {
            throw new Error(`Self-dependency: ${id} depends on itself`);
          }
          depends.push(depIds);
          await this.needN(deps);
        },
        signal: this.#signal,
      };

      const promise = this.#action(context);
      this.#running.set(id, promise);
      await this.#database.put(id, { type: StatusType.RUNNING });

      // Run

      const value = await promise;

      // After

      let changed = this.id;
      if (
        prevStatus &&
        prevStatus.type === StatusType.READY &&
        !Run.#hasChanged(prevStatus.result.value, value)
      ) {
        changed = prevStatus.result.changed;
      }
      const result = {
        value,
        built: this.id,
        changed,
        depends,
      };
      await this.#database.put(id, { type: StatusType.READY, result });
      return value;
    } catch (error) {
      await this.#database.put(id, { type: StatusType.FAILED, error });
      throw error;
    } finally {
      this.#running.delete(id);
    }
  }

  static #hasChanged(prev: Value, next: Value): boolean {
    return JSON.stringify(prev) !== JSON.stringify(next);
  }

  async #isValid(
    status: Status & { type: StatusType.READY },
  ): Promise<boolean> {
    const depStatuses = await Promise.all(
      status.result.depends
        .flatMap((deps) => deps)
        .map((dep) => getWhereReady(this.#database, dep)),
    );
    return depStatuses.every(
      (depStatus) =>
        depStatus && status.result.changed.epochMilliseconds >= depStatus.result.built.epochMilliseconds,
    );
  }
}
