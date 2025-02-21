import markdown from "./markdown";

interface ThingInterface<T> {
  process(content: T): AsyncGenerator<URL, T, T>;
}

export default class Thing implements ThingInterface<string> {
  constructor(private url: URL) {}

  async *process(rawValue: string): AsyncGenerator<URL, string, string> {
    const parts = markdown(rawValue);

    let output: string[] = [];
    for (let part of parts) {
      switch (part.type) {
        case "text":
          output.push(part.text);
          break;
        case "transclusion":
          const childUrlRelativeToDocument = new URL(part.url, this.url);
          const childContent = yield childUrlRelativeToDocument;
          output.push(childContent);
          break;
        case "action":
          // ignore
          break;
      }
    }
    return output.join("");
  }
}
