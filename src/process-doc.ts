import { watch } from "node:fs/promises";
import markdown from "./markdown";
import { file } from "./loaders";
import { Signal } from "signal-polyfill";

type Ref = string;

type Document = {
  value: Signal.Computed<string | undefined>;
  watchAbortController: AbortController;
  dependencies: Set<Ref>;
  parents: Set<Ref>;
};

export class Monument {
  #documents: Map<Ref, Document> = new Map();

  start(url: URL, parent: URL | undefined = undefined): Document["value"] {
    let ref: Ref = url.href;
    let doc = this.#documents.get(ref);

    if (doc) {
      if (parent) {
        doc.parents.add(parent.href);
      }
      return doc.value;
    }

    const dependencies = new Set<Ref>();
    const parents = new Set<Ref>();

    // File watching
    const raw = new Signal.State<string | undefined>(undefined);
    const abortController = new AbortController();
    (async () => {
      async function read() {
        raw.set(await file(url));
      }

      await read();
      try {
        for await (const change of watch(url.pathname, {
          signal: abortController.signal,
        })) {
          switch (change.eventType) {
            case "change":
              await read();
              break;
            default:
              this.stop(url.href, ref);
              break;
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") {
          // ignore
        } else {
          throw e;
        }
      }
    })();

    const value = new Signal.Computed<string | undefined>(() => {
      const rawValue = raw.get();
      if (rawValue === undefined) {
        return;
      }

      const prevDependencies = new Set(dependencies);
      dependencies.clear();

      const parts = markdown(rawValue);

      let output: (string | undefined)[] = [];
      for (let part of parts) {
        switch (part.type) {
          case "text":
            output.push(part.text);
            break;
          case "transclusion":
            const childUrl = new URL(part.url, url);
            const childRef = childUrl.href;
            dependencies.add(childRef);
            const child = this.start(childUrl, url);
            output.push(child.get());
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

      if (output.some((part) => part === undefined)) {
        return;
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
    if (!doc) {
      return;
    }

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
