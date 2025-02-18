export type Text = { type: "text"; text: string };
export type Transclusion = { type: "transclusion"; url: string; name: string };
export type Action = { type: "action"; name: string; description: string };
export type Fragment = Text | Transclusion | Action;
export type Document = Fragment[];

export function text(text: string): Text {
  return { type: "text", text };
}

export function transclusion(url: string, name: string): Transclusion {
  return { type: "transclusion", url, name };
}

export function action(name: string, description: string): Action {
  return { type: "action", name, description };
}
