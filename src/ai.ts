type Model = {
  stream(messages: string[], abortSignal: AbortSignal): AsyncGenerator<string>;
};

export function openai(model: string, apiKey: string): Model {
  const openai = new OpenAI({ apiKey });
  return {
    async *stream(messages, abortSignal) {
      const response = openai.chat.completions.create(
        {
          model,
          messages: messages.map((content) => [{ role: "user", content }]),
          stream: true,
        },
        {
          signal: abortSignal,
        },
      );
      for await (const chunk of response) {
        yield chunk.choices[0]?.delta.content;
      }
    },
  };
}
