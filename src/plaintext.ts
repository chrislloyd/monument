import * as Document from "./document";

export default function* plaintext(
  _: URL,
  content: string,
): Generator<Document.Fragment> {
  yield Document.text(content);
}
