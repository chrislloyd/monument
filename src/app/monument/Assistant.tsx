"use client";

import Markdown from "@/Markdown";
import openai, { type ChatMessage } from "@/openai";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import { useDeferredValue, useEffect, useState } from "react";

type Props = { input: string };

const MODEL = "gpt-4o-mini";
const SEED = 1;
const INPUT_DEBOUNCE_INTERVAL_MS = 1_200;

export default function Assistant({ input }: Props) {
  const deferredInput = useDeferredValue(input.trim());
  const debouncedInput = useDebounce(deferredInput, INPUT_DEBOUNCE_INTERVAL_MS);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const lastMessage = messages[messages.length - 1] || "";
  const lastAssistantMessage = messages.findLast(message => message.role === "assistant");

  useEffect(() => {
    // Reset context when the input is empty
    if (debouncedInput === "") {
      setMessages([]);
      return;
    };

    // Don't re-render if the last input is the same as the current input
    // This can occur when a user edits the field, but then undoes the edit
    // (with backspace or similar).
    const lastUserMessage = messages.findLast(message => message.role === "user");
    if (lastUserMessage?.content === debouncedInput) return;

    setMessages((prevMessages) => ([
      ...prevMessages,
      { role: "user", content: debouncedInput },
    ]));
  }, [debouncedInput]);

  const { data, status } = useQuery({
    // TODO: Hash messages instead of splatting here
    queryKey: ['node', debouncedInput],
    // Only query when the last message was from the user (so it doesn't reply
    // to its own messages).
    enabled: lastMessage?.role === "user",
    queryFn: async ({ signal }) => {
      const response = await openai("v1/chat/completions", {
        model: MODEL,
        messages,
        seed: SEED
      }, signal);
      return response;
    }
  });

  useEffect(() => {
    if (status !== "success") return;
    const message = data.choices[0].message?.content;
    setMessages(prevMessages => ([
      ...prevMessages,
      { role: "assistant", content: message },
    ]));
  }, [status, data]);

  return <Markdown>{lastAssistantMessage?.content || ""}</Markdown>;
}
