import OpenAI from "openai";
import { resolveTransclusionsHmc, type HyperModelContext } from "./hmc";

export type ModelContext =
  OpenAI.Chat.Completions.ChatCompletionUserMessageParam["content"];

export interface Model {
  stream(
    context: ModelContext,
    abortSignal: AbortSignal,
  ): AsyncGenerator<string>;
}

// ---

export class OpenAiModel implements Model {
  #client: OpenAI;

  constructor(
    private readonly model: OpenAI.ChatModel,
    readonly apiKey: string,
  ) {
    this.#client = new OpenAI({ apiKey });
  }

  async *stream(
    context: ModelContext,
    abortSignal: AbortSignal,
  ): AsyncGenerator<string> {
    const response = await this.#client.chat.completions.create(
      {
        model: this.model,
        messages: [{ role: "user", content: context }],
        stream: true,
      },
      {
        signal: abortSignal,
      },
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

export async function mcFromHmc(
  hmc: HyperModelContext,
  need: (url: string) => Promise<unknown>,
): Promise<ModelContext> {
  const parts = await resolveTransclusionsHmc(hmc, need);
  return parts.flatMap((part) => part).join("\n");
}
