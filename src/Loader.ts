import { watch } from "node:fs/promises";

export async function* file(url: URL, signal: AbortSignal) {
  async function read() {
    return Bun.file(url).text();
  }

  yield await read();

  try {
    for await (const change of watch(url.pathname, { signal })) {
      switch (change.eventType) {
        case "change":
          yield await read();
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

export async function* http(url: URL, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP Status: ${response.status}`);
  yield await response.text();
}

export default class Loader {
  constructor(
    private url: URL,
    private signal: AbortSignal,
  ) {}

  async *load(): AsyncGenerator<string, void, void> {
    switch (this.url.protocol) {
      case "file:":
        yield* file(this.url, this.signal);
        break;
      case "http:":
      case "https:":
        yield* http(this.url, this.signal);
        break;
      default:
        throw new Error(`Unsupported protocol: ${this.url.protocol}`);
    }
  }
}
