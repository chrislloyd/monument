import * as Document from "./documents";

export default function* plaintext(
  _: URL,
  content: string,
): Generator<Document.Fragment> {
  yield Document.text(content);
}
