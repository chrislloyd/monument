import OpenAI from "openai";

type Model = {
  stream(messages: string[], abortSignal: AbortSignal): AsyncGenerator<string>;
};

export function openai(model: string, apiKey: string): Model {
  const openai = new OpenAI({ apiKey });
  return {
    async *stream(messages, abortSignal) {
      const response = await openai.chat.completions.create(
        {
          model,
          messages: messages.map((content) => ({
            role: "user",
            content,
          })),
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
    },
  };
}
