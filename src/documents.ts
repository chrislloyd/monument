/**
 * @module documents
 *
 * Documents are a light abstraction over LLM "conversations" that also
 * include the ability to transclude content from other URLs.
 */

export type Text = { type: "text"; text: string };

export type Image = { type: "image"; url: string; description?: string };

export type Link = { type: "link"; url: string; description?: string };

export type Transclusion = {
  type: "transclusion";
  url: string;
  description?: string;
};

type StringParameter = { type: "string" };
type NumberParameter = { type: "number" };
type ObjectParameter = {
  type: "object";
  properties: { [key: string]: ActionParameter };
};
type ArrayParameter = { type: "array"; items: ActionParameter };
export type ActionParameter =
  | StringParameter
  | NumberParameter
  | ObjectParameter
  | ArrayParameter;

export type Action = {
  type: "action";
  name: string;
  description?: string;
  parameter?: ObjectParameter;
};

export type Fragment = Text | Image | Link | Transclusion | Action;

export type Document = Iterable<Fragment>;

// --

export function text(text: string): Text {
  return { type: "text", text };
}

export function image(
  url: Image["url"],
  description?: Image["description"],
): Image {
  return { type: "image", url, description };
}

export function link(
  url: Link["url"],
  description?: Link["description"],
): Link {
  return { type: "link", url, description };
}

export function transclusion(
  url: Transclusion["url"],
  description: Transclusion["description"],
): Transclusion {
  return { type: "transclusion", url, description };
}

export function action(
  name: Action["name"],
  description?: Action["description"],
  parameter?: Action["parameter"],
): Action {
  return { type: "action", name, description, parameter };
}
