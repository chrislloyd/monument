import * as parse5 from "parse5";
import {
  type Fragment,
  type HyperFragment,
  type HyperModelDocument,
} from "./document";
import { markdown } from "./markdown";

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
    }
  }

  if (isTextNode(element)) {
    return [{ type: "text", text: element.value }];
  }

  return [];
}
