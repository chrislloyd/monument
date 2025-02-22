import { watch } from "node:fs/promises";
import { type Resource } from "./resources";
import assert from "node:assert/strict";

async function* file(url: URL, signal: AbortSignal) {
  async function read() {
    const f = Bun.file(url);
    return { content: await f.text(), url, type: f.type };
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

async function* http(url: URL, signal: AbortSignal) {
  const defaultContentType = "text/plain";
  const response = await fetch(url, { signal });
  assert.ok(response.ok, `HTTP Status: ${response.status}`);
  const contentType =
    response.headers.get("Content-Type") || defaultContentType;
  yield { content: await response.text(), url, type: contentType };
}

export default class Loader {
  constructor(private readonly url: URL) {}

  async *load(signal: AbortSignal): AsyncGenerator<Resource, void, void> {
    switch (this.url.protocol) {
      case "file:":
        yield* file(this.url, signal);
        break;
      case "http:":
      case "https:":
        yield* http(this.url, signal);
        break;
      default:
        throw new Error(`Unsupported protocol: ${this.url.protocol}`);
    }
  }
}
