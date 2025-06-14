import * as parse5 from "parse5";
import { type HyperFragment, type HyperModelDocument } from "./document";
import { markdown } from "./markdown";

export async function parse(blob: Blob): Promise<HyperModelDocument["body"]> {
  const contentType = blob.type.split(";")[0]; // Remove charset and other parameters
  
  switch (contentType) {
    case "text/plain": {
      const text = await blob.text();
      return parseText(text);
    }
    case "text/html": {
      const text = await blob.text();
      return parseHtml(text);
    }
    case "text/markdown": {
      const text = await blob.text();
      return parseMarkdown(text);
    }
    default:
      throw new Error(`Cannot parse content type: ${blob.type}`);
  }
}

export async function parseText(
  text: string,
): Promise<HyperModelDocument["body"]> {
  return [{ type: "text", text }];
}

export function parseHtml(html: string): HyperModelDocument["body"] {
  const document = parse5.parseFragment(html);
  return traverse(document.childNodes);
}

export function parseMarkdown(md: string): HyperModelDocument["body"] {
  return parseHtml(markdown(md));
}

function traverse(nodes: any[]): HyperFragment[] {
  let result: HyperFragment[] = [];

  for (const node of nodes) {
    const fragments = process(node);
    result = result.concat(fragments);
  }

  return result;
}

function isTextNode(
  node: parse5.DefaultTreeAdapterTypes.Node,
): node is parse5.DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === "#text";
}

function process(
  element: parse5.DefaultTreeAdapterTypes.Node,
): HyperFragment[] {
  // Early bails are nessecary for type guards as nodeName is `string | #text` etc.

  switch (element.nodeName) {
    case "p":
    case "div": {
      return [
        { type: "text", text: "\n\n" },
        ...traverse(element.childNodes),
        { type: "text", text: "\n\n" },
      ];
    }

    case "ul": {
      return [
        { type: "text", text: "\n\n" },
        ...traverse(element.childNodes),
        { type: "text", text: "\n\n" },
      ];
    }

    case "li": {
      return [];
    }

    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      return [
        { type: "text", text: "\n\n" },
        ...traverse(element.childNodes),
        { type: "text", text: "\n\n" },
      ];
    }

    case "iframe": {
      return [
        {
          type: "transclusion",
          description: element.attrs.find((attr) => attr.name === "title")
            ?.value,
          url: element.attrs.find((attr) => attr.name === "src")?.value!,
        },
      ];
    }
  }

  if (isTextNode(element)) {
    return [{ type: "text", text: element.value }];
  }

  return [];
}
