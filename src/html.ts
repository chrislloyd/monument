import { type HyperModelDocument, type HyperFragment } from "./document";
import * as parse5 from "parse5";

export function parse(url: string, html: string): HyperModelDocument {
  const document = parse5.parseFragment(html);
  return { url, body: Array.from(traverseNodes(document.childNodes)) };
}

function* traverseNodes(nodes: any[]): Generator<HyperFragment> {
  for (const node of nodes) {
    if (isTextNode(node) && node.value.trim() !== "") {
      yield { type: "text", text: node.value };
    } else if (isElementNode(node)) {
      const fragment = processElement(node);
      if (fragment) {
        yield fragment;
      }

      // Process children recursively
      if (node.childNodes && node.childNodes.length > 0) {
        yield* traverseNodes(node.childNodes);
      }
    }
  }
}

function isTextNode(
  node: any,
): node is parse5.DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === "#text";
}

function isElementNode(
  node: any,
): node is parse5.DefaultTreeAdapterTypes.Element {
  return node.nodeName !== "#text" && node.nodeName !== "#document-fragment";
}

function getAttribute(
  element: parse5.DefaultTreeAdapterTypes.Element,
  name: string,
): string | undefined {
  if (!element.attrs) return undefined;

  const attr = element.attrs.find((attr) => attr.name === name);
  return attr ? attr.value : undefined;
}

function processElement(
  element: parse5.DefaultTreeAdapterTypes.Element,
): HyperFragment | null {
  switch (element.nodeName) {
    case "img": {
      const src = getAttribute(element, "src") || "";
      const alt = getAttribute(element, "alt");
      return { type: "image", url: src, description: alt };
    }

    case "iframe": {
      const src = getAttribute(element, "src") || "";
      const title = getAttribute(element, "title");
      return { type: "transclusion", url: src, description: title };
    }

    default:
      return null;
  }
}
