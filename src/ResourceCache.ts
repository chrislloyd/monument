import type { Resource } from "./resources";
import type Scheduler from "./Scheduler";
import Watcher from "./Watcher";

interface Cache<K, V> {
  read(key: K): Promise<V | null>;
}

export default class ResourceCache implements Disposable, Cache<URL, Resource> {
  private cache = new Map<string, Resource>();
  private controllers = new Map<string, AbortController>();

  constructor(
    private readonly watcher: Watcher,
    private readonly scheduler: Scheduler,
  ) {}

  async read(url: URL): Promise<Resource> {
    const key = url.href;

    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    const abortController = new AbortController();
    this.controllers.set(key, abortController);

    await this.scheduler.schedule(async () => {
      for await (const resource of this.watcher.watch(
        url,
        abortController.signal,
      )) {
        this.cache.set(key, resource);
      }
    }, 0);

    const controller = new AbortController();
    const gen = this.watcher.watch(url, controller);
    const out = await gen.next();
    return out.value;
  }

  // async read(url: URL): Promise<Resource> {
  //   const key = url.href;

  //   if (!this.cache.has(key)) {
  //     const entry = this.fetch(url);
  //   }

  //   return this.cache.get(key);

  //   // let entry = this.cache.get(key);
  //   // if (!entry) {
  //   //   const controller = new AbortController();
  //   //   const signal = controller.signal;
  //   //   const promise = this.watcher.watch(url, signal).next();
  //   //   entry = { promise, controller };
  //   //   this.cache.set(key, entry);
  //   // }
  //   // return entry.promise;
  // }

  // private fetch(url: URL): CacheEntry {
  //   const controller = new AbortController();
  //   let entry: CacheEntry = {
  //     controller,
  //   };

  //   for await (const resource of this.watcher.watch(
  //     url,
  //     abortController.signal,
  //   )) {
  //     entry.resource = resource;
  //   }
  // }

  [Symbol.dispose]() {}
}
