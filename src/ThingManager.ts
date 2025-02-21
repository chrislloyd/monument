import markdown from "./markdown";
import { Signal } from "signal-polyfill";
import type { Model } from "./models";
import { AsyncComputed } from "signal-utils/async-computed";
import Loader from "./Loader";

type Ref = string;

type Document = {
  value: AsyncComputed<string>;
  watchAbortController: AbortController;
  dependencies: Set<Ref>;
  parents: Set<Ref>;
};

export default class ThingMananger {
  #documents: Map<Ref, Document> = new Map();

  constructor(private readonly model: Model) {}

  async want(url: URL): Promise<Document["value"]> {
    return await this.start(url, undefined);
  }

  // --

  private async start(
    url: URL,
    parent: URL | undefined,
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

    const loader = new Loader(url);
    // TODO: This needs to abort when ThingManager is disposed
    const abortController = new AbortController();
    const resourceGenerator = loader.load(abortController.signal);

    // Wait for initial resource to load so we don't need to propagate a
    // potentially undefined value throughout the rest of the system.
    const initialResource = await resourceGenerator.next();
    if (!initialResource.value)
      throw new Error("Loader returned without yielding resoure");

    const resourceSignal = new Signal.State(initialResource.value);
    (async () => {
      for await (const resource of resourceGenerator) {
        resourceSignal.set(resource);
      }
      this.stop(url.href, ref);
    })();

    // TODO: AsyncComputed doesn't actually abort the signal
    // https://github.com/proposal-signals/signal-utils/issues/87
    const valueSignal = new AsyncComputed(async (signal) => {
      const resource = resourceSignal.get();

      const prevDependencies = new Set(dependencies);
      dependencies.clear();

      const parts = markdown(resource.content);

      let messages: string[] = [];
      for (let part of parts) {
        switch (part.type) {
          case "text":
            messages.push(part.text);
            break;
          case "transclusion":
            const childUrl = new URL(part.url, url);
            const childRef = childUrl.href;
            dependencies.add(childRef);
            const child = await this.start(childUrl, url);
            const childContent = await child.complete;
            messages.push(childContent);
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

      let chunks = [];
      for await (const chunk of this.model.stream(messages, signal)) {
        chunks.push(chunk);
      }

      return chunks.join("");
    });

    doc = {
      value: valueSignal,
      dependencies: dependencies,
      watchAbortController: abortController,
      parents: parents,
    };

    this.#documents.set(ref, doc);

    return doc.value;
  }

  private stop(id: Ref, from: Ref) {
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
