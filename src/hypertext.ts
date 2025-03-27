/**
 * Hypertext
 *
 * Takes a string of HTML and returns a generator that yields a sequence of
 * document fragments.
 */
import * as hmc from "./hmc";
import * as parse5 from "parse5";

export function hypertext(html: string): hmc.HyperModelContext {
  const document = parse5.parseFragment(html);
  return Array.from(traverseNodes(document.childNodes));
}

function* traverseNodes(nodes: any[]): Generator<hmc.Fragment> {
  for (const node of nodes) {
    if (isTextNode(node) && node.value.trim() !== "") {
      yield hmc.text(node.value);
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
): hmc.Fragment | null {
  switch (element.nodeName) {
    case "a": {
      const href = getAttribute(element, "href") || "";
      const description =
        element.childNodes
          .filter((child) => isTextNode(child))
          .map((child) => child.value)
          .join(" ") || "";
      return hmc.link(href, description);
    }

    case "img": {
      const src = getAttribute(element, "src") || "";
      const alt = getAttribute(element, "alt");
      return hmc.image(src, alt);
    }

    case "form": {
      const action = getAttribute(element, "action") || "";
      const method = getAttribute(element, "method") || "GET";

      // Create the action fragment
      const actionFragment = hmc.action(`${method} ${action}`, "Submit");

      // Process input fields within the form
      processFormInputs(element, actionFragment);

      return actionFragment;
    }

    case "iframe": {
      const src = getAttribute(element, "src") || "";
      const title = getAttribute(element, "title");
      return hmc.transclusion(src, title);
    }

    default:
      return null;
  }
}

function processFormInputs(
  formElement: parse5.DefaultTreeAdapterTypes.Element,
  actionFragment: hmc.Fragment & { type: "action" },
): void {
  if (!actionFragment || actionFragment.type !== "action") return;

  const inputs = findInputElements(formElement);

  if (inputs.length === 0) return;

  actionFragment.parameter = {
    type: "object",
    properties: {},
  };

  for (const input of inputs) {
    const name = getAttribute(input, "name");
    if (!name || name.trim() === "") continue;

    let property: hmc.ActionParameter = { type: "string" };
    const inputType = getAttribute(input, "type");

    if (inputType === "number") {
      property = { type: "number" };
    }

    actionFragment.parameter.properties[name] = property;
  }
}

function findInputElements(
  element: parse5.DefaultTreeAdapterTypes.Element,
): parse5.DefaultTreeAdapterTypes.Element[] {
  const inputs: parse5.DefaultTreeAdapterTypes.Element[] = [];

  function traverse(node: any) {
    if (isElementNode(node)) {
      if (node.nodeName === "input") {
        inputs.push(node);
      }

      if (node.childNodes) {
        for (const child of node.childNodes) {
          traverse(child);
        }
      }
    }
  }

  traverse(element);
  return inputs;
}
