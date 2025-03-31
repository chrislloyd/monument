/**
 * Largely inspired by Objective-S's storage combinators. This interface is
 * meant to wrap a hierarchial storage system in a way that mimics REST. Unlike
 * Objective-S, operations are async by default to help smooth over network
 * storage.
 */
import { type BunFile } from "bun";

type Ref = string;

export interface Storage<T> {
  get(ref: Ref): Promise<T | void>;
  put(ref: Ref, object: T): Promise<void>;
}

// ---

// This isn't thread-safe, but it's good enough for now.
export class FileStorage<T> implements Storage<T> {
  #file: BunFile;

  constructor(private readonly path: string) {
    this.#file = Bun.file(path);
  }

  async create() {
    await Bun.write(this.path, JSON.stringify({}), { createPath: true });
  }

  async get(ref: Ref): Promise<T | void> {
    const data = await this.#read();
    return data[ref];
  }

  async put(ref: Ref, object: T): Promise<void> {
    const data = await this.#read();
    data[ref] = object;
    await Bun.write(this.path, JSON.stringify(data), { createPath: true });
  }

  async #read(): Promise<any> {
    const text = await this.#file.text();
    return JSON.parse(text);
  }
}

// ---

export class MemoryStorage<T> implements Storage<T> {
  #data = new Map<Ref, T>();

  async get(ref: Ref): Promise<T | void> {
    return this.#data.get(ref);
  }

  async put(ref: Ref, object: T): Promise<void> {
    this.#data.set(ref, object);
  }
}
