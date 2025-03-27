import {
  type Fragment,
  type HyperModelDocument,
  type ModelDocument,
} from "./document";
import { parse } from "./html";
import type { Loader } from "./loader";
import markdown from "./markdown";

export interface Resolver {
  resolve(
    hyperModelDocument: HyperModelDocument,
    signal: AbortSignal,
  ): Promise<ModelDocument>;
}

// ---

export class Resolver implements Resolver {
  constructor(
    private readonly loader: Loader,
    private readonly cb: (url: URL) => Promise<void>,
  ) {}

  async resolve(
    doc: HyperModelDocument,
    signal: AbortSignal,
  ): Promise<ModelDocument> {
    const baseUrl = new URL(doc.url);
    const body: Fragment[][] = await Promise.all(
      doc.body.map(async (fragment): Promise<Fragment[]> => {
        switch (fragment.type) {
          case "text":
            return [
              {
                type: "blob",
                blob: new Blob([fragment.text], { type: "text/plain" }),
              },
            ];

          case "image": {
            const url = new URL(fragment.url, baseUrl);
            const blob = await this.loader.load(url, signal);
            return [{ type: "blob", blob }];
          }

          case "transclusion": {
            const url = new URL(fragment.url, baseUrl);
            await this.cb(url);

            const blob = await this.loader.load(url, signal);
            const text = await blob.text();
            const html = markdown(text);
            const childHyperDoc = parse(url.href, html);

            const childDoc = await this.resolve(childHyperDoc, signal);
            return childDoc.body;
          }
          default:
            throw new Error(
              `Unabled to resolve fragment type "${fragment.type}"`,
            );
        }
      }),
    );
    return { body: body.flatMap((frag) => frag) };
  }
}
