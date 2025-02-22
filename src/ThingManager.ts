import { Signal } from "signal-polyfill";
import type { Model } from "./models";
import { AsyncComputed } from "signal-utils/async-computed";
import Loader from "./Loader";
import Renderer, { type RenderContext } from "./Renderer";
import assert from "node:assert/strict";

type Ref = string;

type Thing = {
  abortController: AbortController;
  children: Set<Ref>;
  value: AsyncComputed<string>;
};

export default class ThingMananger {
  #things: Map<Ref, Thing> = new Map();

  constructor(private readonly model: Model) {}

  async want(url: URL): Promise<Thing["value"]> {
    return await this.start(url, undefined);
  }

  // --

  private async start(
    url: URL,
    parent: URL | undefined,
  ): Promise<Thing["value"]> {
    if (parent)
      assert.notEqual(url, parent, `Can't start from same url ${url.href}`);

    let ref: Ref = url.href;
    let thing = this.#things.get(ref);

    // Upsert thing
    if (thing) {
      return thing.value;
    }

    const children = new Set<Ref>();

    const loader = new Loader(url);
    // TODO: This needs to abort when ThingManager is disposed
    const abortController = new AbortController();
    const resourceGenerator = loader.load(abortController.signal);

    // Wait for initial resource to load so we don't need to propagate a
    // potentially undefined value throughout the rest of the system.
    const initialResource = await resourceGenerator.next();
    assert.ok(
      initialResource.value,
      "Loader returned without yielding resoure",
    );

    const resourceSignal = new Signal.State(initialResource.value);
    (async () => {
      for await (const resource of resourceGenerator) {
        resourceSignal.set(resource);
      }
    })();

    // TODO: AsyncComputed doesn't actually abort the signal
    // https://github.com/proposal-signals/signal-utils/issues/87
    const valueSignal = new AsyncComputed(async (signal) => {
      const resource = resourceSignal.get();

      const prevChildren = new Set(children);
      children.clear();

      const renderer = new Renderer(resource);
      const ctx: RenderContext = {
        needs: async (dep) => {
          const childUrl = new URL(dep, url);
          children.add(childUrl.href);
          const child = await this.start(childUrl, url);
          return await child.complete;
        },
      };
      const messages = await renderer.render(ctx);

      // Cleanup removed dependencies
      for (const dep of prevChildren.difference(children)) {
        this.stop(dep, ref);
      }

      let chunks = [];
      for await (const chunk of this.model.stream([messages], signal)) {
        chunks.push(chunk);
      }

      return chunks.join("");
    });

    thing = {
      value: valueSignal,
      children: children,
      abortController: abortController,
    };

    this.#things.set(ref, thing);

    return thing.value;
  }

  private stop(id: Ref, parentId: Ref) {
    assert.notEqual(id, parentId, "Can't stop from same id");

    const thing = this.#things.get(id);
    assert.ok(thing, `Unable to stop, ${id} not found`);

    const parent = this.#things.get(parentId);
    assert.ok(parent, `Unable to stop, parent ${parentId} not found`);

    parent.children.delete(id);

    if (!this.#things.values().some((p) => p.children.has(id))) {
      thing.abortController.abort();
      for (const dep of thing.children) {
        this.stop(dep, id);
      }
      this.#things.delete(id);
    }
  }
}
