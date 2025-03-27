import { urlFromReference, type Reference } from "./reference";
import { type Resource } from "./resource";
import assert from "node:assert/strict";

export interface Loader {
  load(reference: Reference, signal: AbortSignal): Promise<Resource>;
}

export class Loader implements Loader {
  async load(ref: Reference, signal: AbortSignal): Promise<Resource> {
    switch (ref.protocol) {
      case "file":
        return file(ref);
      case "http":
      case "https":
        return http(ref, signal);
      default:
        throw new Error(`Unsupported protocol: ${ref.protocol}`);
    }
  }
}

async function file(ref: Reference): Promise<Resource> {
  const url = urlFromReference(ref);
  const f = Bun.file(url);
  return { content: await f.text(), ref, type: f.type };
}

async function http(
  ref: Reference,
  abortSignal: AbortSignal,
): Promise<Resource> {
  const defaultContentType = "text/plain";
  const url = urlFromReference(ref);
  const response = await fetch(url, { signal });
  assert.ok(response.ok, `HTTP Status: ${response.status}`);
  const contentType =
    response.headers.get("Content-Type") || defaultContentType;
  return { content: await response.text(), ref, type: contentType };
}
