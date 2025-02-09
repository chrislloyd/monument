/**
 * Represents a plain text fragment in a document.
 * Used for standard markdown content that doesn't contain special syntax.
 */
export type Text = { type: "text", text: string };

/**
 * Represents an embedded content fragment in a document.
 * Created from markdown image syntax: ![name](url)
 */
export type Transclusion = { type: "transclusion", url: string, name: string };

/**
 * Represents an interactive element in a document.
 * Created from markdown link syntax: [description](name)
 */
export type Action = { type: "action", name: string, description: string };

/**
 * Creates a text fragment from a string.
 * @param text - The content of the text fragment
 * @returns A Text fragment object
 * @example
 * ```typescript
 * const fragment = text("Hello, world");
 * // { type: "text", text: "Hello, world" }
 * ```
 */
export function text(text: string): Text {
  return { type: "text", text };
}

/**
 * Creates a transclusion fragment for embedded content.
 * @param url - The source URL of the content to embed
 * @param name - A description of the embedded content
 * @returns A Transclusion fragment object
 * @example
 * ```typescript
 * const fragment = transclusion("http://api.weather.com", "Weather");
 * // { type: "transclusion", url: "http://api.weather.com", name: "Weather" }
 * ```
 */
export function transclusion(url: string, name: string): Transclusion {
  return { type: "transclusion", url, name };
}

/**
 * Creates an action fragment for interactive elements.
 * @param name - The identifier/command for the action
 * @param description - A user-friendly description of the action
 * @returns An Action fragment object
 * @example
 * ```typescript
 * const fragment = action("refresh", "Update Data");
 * // { type: "action", name: "refresh", description: "Update Data" }
 * ```
 */
export function action(name: string, description: string): Action {
  return { type: "action", name, description };
}

/**
 * Union type representing all possible fragment types in a document.
 * Used for type-safe handling of different content types.
 */
export type Fragment =
  | Text
  | Transclusion
  | Action;

/**
 * Represents a complete document as an array of fragments.
 * Documents are processed sequentially, with each fragment handled according to its type.
 */
export type Document = Fragment[];
