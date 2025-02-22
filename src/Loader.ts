import { type Resource } from "./resources";
import assert from "node:assert/strict";

async function file(url: URL): Promise<Resource> {
  const f = Bun.file(url);
  return { content: await f.text(), url, type: f.type };
}

async function http(url: URL, signal: AbortSignal): Promise<Resource> {
  const defaultContentType = "text/plain";
  const response = await fetch(url, { signal });
  assert.ok(response.ok, `HTTP Status: ${response.status}`);
  const contentType =
    response.headers.get("Content-Type") || defaultContentType;
  return { content: await response.text(), url, type: contentType };
}

export default class Loader {
  async load(url: URL, signal: AbortSignal): Promise<Resource> {
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
