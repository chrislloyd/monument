import { watch } from "node:fs/promises";
import { type Resource } from "./resource";
import { type Loader } from "./loader";
import type { Reference } from "./reference";

export interface Watcher {
  watch(
    ref: Reference,
    abortSignal: AbortSignal,
  ): AsyncGenerator<Resource, void, void>;
}

// ---

async function* file(loader: Loader, url: URL, abortSignal: AbortSignal) {
  yield await loader.load(url, signal);
  try {
    for await (const change of watch(url.pathname, { signal })) {
      switch (change.eventType) {
        case "change":
          yield await loader.load(url, signal);
          break;
        default:
          return;
      }
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      // ignore
    } else {
      throw e;
    }
  }
}

export class Watcher implements Watcher {
  constructor(private readonly loader: Loader) {}
  async *watch(
    url: URL,
    abortSignal: AbortSignal,
  ): AsyncGenerator<Resource, void, void> {
    switch (url.protocol) {
      case "file:":
        yield* file(this.loader, url, signal);
        break;
      default:
        yield this.loader.load(url, signal);
    }
  }
}
