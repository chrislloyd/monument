/**
 * Hypertext
 *
 * Takes a string of HTML and returns a generator that yields a sequence of
 * document fragments.
 */
import * as doc from "./documents";

export function* hypertext(html: string): doc.Document {
  const fragments: doc.Fragment[] = [];
  const rewriter = new HTMLRewriter();
  rewriter.on("*", {
    element() {
      fragments.push();
    },
    text(text) {
      if (text.text.trim() === "") {
        return;
      }
      fragments.push(doc.text(text.text));
    },
  });
  rewriter.on("a", {
    element(element) {
      const href = element.getAttribute("href") || "";
      fragments.push(doc.link(href));
    },
  });
  rewriter.on("img", {
    element(element) {
      const src = element.getAttribute("src") || "";
      const alt = element.getAttribute("alt") || undefined;
      fragments.push(doc.image(src, alt));
    },
  });
  rewriter.on("form", {
    element(element) {
      const action = element.getAttribute("action") || "";
      const method = element.getAttribute("method") || "GET";
      fragments.push(doc.action(`${method} ${action}`, "Submit"));
    },
  });
  rewriter.on("input", {
    element(element) {
      const lastFragment = fragments[fragments.length - 1];
      if (lastFragment?.type !== "action") {
        return;
      }

      let property: doc.ActionParameter = { type: "string" };
      switch (element.getAttribute("type")) {
        case "number":
          property = { type: "number" };
          break;

        case "text":
        default:
          break;
      }

      const name = element.getAttribute("name") || "";
      if (name.trim() === "") {
        return;
      }

      lastFragment.parameter ||= {
        type: "object",
        properties: {},
      };

      if (lastFragment.parameter) {
        lastFragment.parameter.properties[name] = property;
      }
    },
  });
  rewriter.on("iframe", {
    element(element) {
      const src = element.getAttribute("src") || "";
      const title = element.getAttribute("title") || undefined;
      fragments.push(doc.transclusion(src, title));
    },
  });
  rewriter.transform(html);

  for (const fragment of fragments) {
    yield fragment;
  }
}
