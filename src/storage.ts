/**
 * Largely inspired by Objective-S's storage combinators. This interface is
 * meant to wrap a hierarchial storage system in a way that mimics REST. Unlike
 * Objective-S, operations are async by default to help smooth over network
 * storage.
 */
import { type BunFile } from "bun";
import { type Reference } from "./reference";

export interface Storage<T, Ref extends Reference = Reference> {
  get(ref: Ref): Promise<T | void>;
  put(ref: Ref, object: T): Promise<void>;
}

// ---

function keyFromReference(ref: Reference): string {
  return `${ref.protocol}:${ref.path}`;
}

// ---

// This isn't thread-safe, but it's good enough for now.
export class FileStorage<T> implements Storage<T> {
  #cache = {};
  #file: BunFile;

  constructor(private readonly path: string) {
    this.#file = Bun.file(path);
  }

  async create() {
    await Bun.write(this.path, JSON.stringify({}), { createPath: true });
  }

  async get(ref: Reference): Promise<T | void> {
    const key = keyFromReference(ref);
    const data = await this.#read();
    return data[key];
  }

  async put(ref: Reference, object: T): Promise<void> {
    const key = keyFromReference(ref);
    const data = await this.#read();
    data[key] = object;
    await Bun.write(this.path, JSON.stringify(data), { createPath: true });
  }

  async #read(): Promise<any> {
    const text = await this.#file.text();
    return JSON.parse(text);
  }
}

// ---

export class MemoryStorage<T> implements Storage<T> {
  #data = new Map<ReturnType<typeof keyFromReference>, T>();

  async get(ref: Reference): Promise<T | void> {
    return this.#data.get(keyFromReference(ref));
  }

  async put(ref: Reference, object: T): Promise<void> {
    this.#data.set(keyFromReference(ref), object);
  }
}
