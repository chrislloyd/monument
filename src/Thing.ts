import { watch } from "fs/promises";
import Loader from "./Loader";
import markdown from "./markdown";

interface ThingInterface<T> {
  poll(signal: AbortSignal): AsyncGenerator<T>;
  process(content: T): AsyncGenerator<URL, T, T>;
}

export default class Thing implements ThingInterface<string> {
  constructor(private url: URL) {}

  async *poll(signal: AbortSignal) {
    const loader = new Loader(this.url, signal);
    yield* loader.load();
  }

  async *process(rawValue: string): AsyncGenerator<URL, string, string> {
    const parts = markdown(rawValue);

    let output: string[] = [];
    for (let part of parts) {
      switch (part.type) {
        case "text":
          output.push(part.text);
          break;
        case "transclusion":
          const childUrlRelativeToDocument = new URL(part.url, this.url);
          const childContent = yield childUrlRelativeToDocument;
          output.push(childContent);
          break;
        case "action":
          // ignore
          break;
      }
    }
    return output.join("");
  }
}
