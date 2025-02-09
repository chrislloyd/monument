import NodeHtmlParser, { HTMLElement, Node, TextNode } from 'node-html-parser';
import * as Document from './document';

export default function* html(url: URL, content: string): Generator<Document.Fragment> {
  const root = NodeHtmlParser.parse(content, {
    blockTextElements: {
      script: false,
      noscript: false,
      style: false,
    }
  });

  function* processNode(node: Node): Generator<Document.Fragment> {
    if (node instanceof TextNode) {
      const text = node.text.trim();
      if (text) {
        yield Document.text(text);
      }
      return;
    }

    if (!(node instanceof HTMLElement)) {
      return;
    }

    if (node.tagName === 'A') {
      const href = node.getAttribute('href');
      if (href) {
        yield Document.action(new URL(href, url).href, node.innerText.trim());
      }
      return;
    }

    for (const child of node.childNodes) {
      yield* processNode(child);
    }
  }

  yield* processNode(root);
}
