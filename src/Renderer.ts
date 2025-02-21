import md from "./markdown";
import type { Resource } from "./resources";

export type RenderContext = {
  needs(deps: string): Promise<string>;
};

function plaintext(resource: Resource): string {
  return resource.content;
}

async function markdown(
  resource: Resource,
  ctx: RenderContext,
): Promise<string> {
  const document = md(resource.content);
  let parts: string[] = [];
  for (let fragment of document) {
    switch (fragment.type) {
      case "text":
        parts.push(fragment.text);
        break;
      case "transclusion":
        const child = await ctx.needs(fragment.url);
        parts.push(child);
        break;
      case "action":
        // ignore
        break;
    }
  }
  return parts.join("");
}

export default class Renderer {
  constructor(private readonly resource: Resource) {}

  async render(ctx: RenderContext): Promise<string> {
    switch (this.resource.type) {
      case "text/markdown":
        return await markdown(this.resource, ctx);
      case "text/plain":
      default:
        return plaintext(this.resource);
    }
  }
}
