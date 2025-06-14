import Anthropic from "@anthropic-ai/sdk";
import { type ModelDocument } from "./document";
import { dataUrlFromBlob } from "./url";

export interface Model {
  stream(document: ModelDocument, signal: AbortSignal): AsyncGenerator<string>;
}

// ---

export class AnthropicModel implements Model {
  #client: Anthropic;

  constructor(
    private readonly model: string,
    readonly apiKey: string,
  ) {
    this.#client = new Anthropic({ apiKey });
  }

  async *stream(
    document: ModelDocument,
    signal: AbortSignal,
  ): AsyncGenerator<string> {
    const messages: Anthropic.MessageParam[] = [];
    const messageContent: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[] = [];
    
    for (const fragment of document.body) {
      switch (fragment.type) {
        case "blob": {
          switch (fragment.blob.type) {
            case "text/plain;charset=utf-8":
              const text = await fragment.blob.text();
              messageContent.push({ type: "text", text });
              break;
            case "image/jpeg":
              const imageData = await fragment.blob.arrayBuffer();
              const base64 = Buffer.from(imageData).toString('base64');
              messageContent.push({
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/jpeg",
                  data: base64
                }
              });
              break;
            default:
              throw new Error(`Unsupported blob type: ${fragment.blob.type}`);
          }
          break;
        }
        case "action":
          break;
      }
    }
    
    if (messageContent.length > 0) {
      messages.push({ role: "user", content: messageContent });
    }
    
    const stream = await this.#client.messages.create({
      model: this.model,
      messages,
      stream: true,
      max_tokens: 4096,
    }, { signal });
    
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield chunk.delta.text;
      }
    }
  }
}

// ---

export class NoopModel implements Model {
  async *stream(
    document: ModelDocument,
    signal: AbortSignal,
  ): AsyncGenerator<string> {
    // Simply concatenate all text content from the document
    for (const fragment of document.body) {
      if (fragment.type === "blob") {
        const contentType = fragment.blob.type.split(";")[0];
        if (contentType === "text/plain" || contentType === "text/html" || contentType === "text/markdown") {
          yield await fragment.blob.text();
        }
      }
    }
  }
}
