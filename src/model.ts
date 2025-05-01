import OpenAI from "openai";
import { type ModelDocument } from "./document";
import { dataUrlFromBlob } from "./url";

export interface Model {
  stream(document: ModelDocument, signal: AbortSignal): AsyncGenerator<string>;
}

// ---

export class OpenAiModel implements Model {
  #client: OpenAI;

  constructor(
    private readonly model: OpenAI.ChatModel,
    readonly apiKey: string,
  ) {
    this.#client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
  }

  async *stream(
    document: ModelDocument,
    signal: AbortSignal,
  ): AsyncGenerator<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [];
    for (const fragment of document.body) {
      switch (fragment.type) {
        case "blob": {
          let content;
          switch (fragment.blob.type) {
            case "text/plain;charset=utf-8":
              content = await fragment.blob.text();
              break;
            case "image/jpeg":
              const imageUrl = await dataUrlFromBlob(fragment.blob);
              const contentPart: OpenAI.Chat.Completions.ChatCompletionContentPartImage =
                { type: "image_url", image_url: { url: imageUrl } };
              content = [contentPart];
              break;
            default:
              throw new Error(
                `OpenAI Error: Unsupported blob type: ${fragment.blob.type}`,
              );
          }
          messages.push({ role: "user", content });
          break;
        }
        case "action":
          break;
      }
    }
    const response = await this.#client.chat.completions.create(
      {
        model: this.model,
        messages,
        stream: true,
        // OpenAI defaults to picking a tool even if none are supplied
        tools: tools.length > 0 ? tools : undefined,
      },
      { signal },
    );
    for await (const chunk of response) {
      const content = chunk.choices[0]?.delta.content;
      if (!content) {
        continue;
      }
      yield content;
    }
  }
}
