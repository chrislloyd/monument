/**
 * Largely inspired by Objective-S's storage combinators. This interface is
 * meant to wrap a hierarchial storage system in a way that mimics REST. Unlike
 * Objective-S, operations are async by default to help smooth over network
 * storage.
 */
import { type BunFile } from "bun";

export interface Storage<T> {
  get(ref: URL): Promise<T | void>;
  put(ref: URL, object: T): Promise<void>;
}

// ---

function keyFromURL(url: URL): string {
  return url.href;
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

  async get(url: URL): Promise<T | void> {
    const key = keyFromURL(url);
    const data = await this.#read();
    return data[key];
  }

  async put(url: URL, object: T): Promise<void> {
    const key = keyFromURL(url);
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
  #data = new Map<ReturnType<typeof keyFromURL>, T>();

  async get(url: URL): Promise<T | void> {
    return this.#data.get(keyFromURL(url));
  }

  async put(url: URL, object: T): Promise<void> {
    this.#data.set(keyFromURL(url), object);
  }
}
