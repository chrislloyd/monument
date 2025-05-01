import * as assert from "./assert";

export interface Loader {
  load(url: URL, signal: AbortSignal): Promise<Blob>;
}

export class Loader implements Loader {
  async load(url: URL, signal: AbortSignal): Promise<Blob> {
    switch (url.protocol) {
      case "file:":
        return file(url);
      case "http:":
      case "https:":
        return http(url, signal);
      default:
        throw new Error(`Unsupported protocol: ${url.protocol}`);
    }
  }
}

export class BunLoader implements Loader {
  constructor(private loader: Loader) {}
  async load(url: URL, signal: AbortSignal): Promise<Blob> {
    if (url.protocol === "file:") {
      return file(url);
    }
    return this.loader.load(url, signal);
  }
}

async function file(url: URL): Promise<Blob> {
  assert.equal(url.protocol, "file:");
  const f = Bun.file(url);
  if (!(await f.exists())) {
    throw new Error(`File not found ${url.pathname}`);
  }
  return f;
}

async function http(url: URL, signal: AbortSignal): Promise<Blob> {
  assert.ok(url.protocol === "http:" || url.protocol === "https:");
  const response = await fetch(url, { signal });
  assert.ok(response.ok);
  return await response.blob();
}
