import markdown from "./markdown";
import { Signal } from "signal-polyfill";
import type { Model } from "./models";
import { AsyncComputed } from "signal-utils/async-computed";
import Thing from "./Thing";

type Ref = string;

type Document = {
  value: AsyncComputed<string>;
  watchAbortController: AbortController;
  dependencies: Set<Ref>;
  parents: Set<Ref>;
};

export default class ThingMananger {
  #documents: Map<Ref, Document> = new Map();

  constructor(
    private model: Model,
    private cwd: string,
    private out: string,
  ) {}

  async start(
    url: URL,
    parent: URL | undefined = undefined,
  ): Promise<Document["value"]> {
    let ref: Ref = url.href;
    let doc = this.#documents.get(ref);

    // Upsert document
    if (doc) {
      if (parent) {
        doc.parents.add(parent.href);
      }
      return doc.value;
    }

    const dependencies = new Set<Ref>();
    const parents = new Set<Ref>();

    const thing = new Thing(url);

    const abortController = new AbortController();
    const generator = thing.poll(abortController.signal);

    const firstValue = await generator.next();
    if (!firstValue.value) throw new Error("Document generator didn't yield");

    const raw = new Signal.State(firstValue.value);

    (async () => {
      for await (const content of generator) {
        raw.set(content);
      }
      this.stop(url.href, ref);
    })();

    const value = new AsyncComputed(async () => {
      const rawValue = raw.get();

      const prevDependencies = new Set(dependencies);
      dependencies.clear();

      const parts = markdown(rawValue);

      let output: string[] = [];
      for (let part of parts) {
        switch (part.type) {
          case "text":
            output.push(part.text);
            break;
          case "transclusion":
            const childUrl = new URL(part.url, url);
            const childRef = childUrl.href;
            dependencies.add(childRef);
            const child = await this.start(childUrl, url);
            const childContent = await child.complete;
            output.push(childContent);
            break;
          case "action":
            // ignore
            break;
        }
      }

      // Cleanup removed dependencies
      for (const dep of prevDependencies.difference(dependencies)) {
        this.stop(dep, ref);
      }

      return output.join("");
    });

    doc = {
      value: value,
      dependencies: dependencies,
      watchAbortController: abortController,
      parents: parents,
    };

    this.#documents.set(ref, doc);

    return doc.value;
  }

  stop(id: Ref, from: Ref) {
    const doc = this.#documents.get(id);
    if (!doc) throw new Error(`Unable to stop, document ${id} not found`);

    doc.parents.delete(from);

    if (doc.parents.size === 0) {
      doc.watchAbortController.abort();
      for (const dep of doc.dependencies) {
        this.stop(dep, id);
      }
      this.#documents.delete(id);
    }
  }
}
