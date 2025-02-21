import * as Document from "./documents";

/**
 * Processes markdown content and yields document fragments. Extends standard markdown with:
 * - Transclusions: `![description](source)` - embeds external content
 * - Actions: `[description](source)` - creates interactive links
 *
 * The function parses the content and breaks it into fragments:
 * 1. Plain text between special syntax
 * 2. Transclusions for embedding external content
 * 3. Actions for interactive elements
 *
 * @param content - The markdown content to process
 * @yields {Document.Fragment} Document fragments in sequence:
 *   - Document.text() for plain text
 *   - Document.transclusion() for embedded content
 *   - Document.action() for interactive links
 * @example
 * ```typescript
 * const content = `
 *   # Hello
 *   ![weather](http://api.weather.com)
 *   [refresh](action:refresh)
 * `;
 * for (const fragment of markdown(content)) {
 *   console.log(fragment);
 * }
 * ```
 */
export default function* markdown(
  content: string,
): Generator<Document.Fragment> {
  // Build regex for matching both transclusions (![]()) and actions ([]()):
  const markdownLinkRegex = new RegExp(
    [
      "(!?)", // Optional ! prefix for transclusions
      "\\[", // Opening [ for description
      "(?<description>[^\\]]*)", // Description content (anything but ])
      "\\]", // Closing ] for description
      "\\(", // Opening ( for source
      "(?<src>[^)]*)", // Source content (anything but ))
      "\\)", // Closing ) for source
    ].join(""),
    "g",
  ); // Global flag to match all occurrences

  // Find all markdown links (both transclusions and actions) in the content
  const matches = Array.from(content.matchAll(markdownLinkRegex));

  // Track our position in the content as we process it
  let offset = 0;

  for (const match of matches) {
    // If there's text before this match, yield it as a text fragment
    if (match.index !== 0) {
      yield Document.text(content.slice(offset, match.index));
    }

    // Extract the link's description and source from named capture groups
    const { src = "", description = "" } = match.groups || {};

    // If the match starts with !, it's a transclusion, otherwise it's an action
    if (match[1] === "!") {
      yield Document.transclusion(src, description);
    } else {
      yield Document.action(src, description);
    }

    // Update offset to the end of this match
    offset = match.index + match[0].length;
  }

  // If there's any remaining text after the last match, yield it
  if (offset !== content.length) {
    yield Document.text(content.slice(offset));
  }
}
