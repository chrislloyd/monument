"use client";

import Editor, { EditorChangeHandler } from "@/Editor";
import Markdown from "@/Markdown";
import openai from "@/openai";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import { useCallback, useDeferredValue, useState } from "react";

const MODEL = "gpt-4o-mini";
const SEED = 1;
const INPUT_DEBOUNCE_INTERVAL_MS = 500;

export default function Page() {
  const [input, setInput] = useState<string>("");
  const [output, setOutput] = useState<string>("");

  const handleChange = useCallback<EditorChangeHandler>((e) => {
    setInput(e);
  }, [setInput]);

  const deferredInput = useDeferredValue(input);
  const debouncedInput = useDebounce(deferredInput.trim(), INPUT_DEBOUNCE_INTERVAL_MS);

  const query = useQuery({
    queryKey: ['node', debouncedInput],
    queryFn: async ({ signal }) => {
      const out = await openai("v1/chat/completions", {
        model: MODEL,
        messages: [{ role: "user", content: debouncedInput }],
        seed: SEED
      }, signal);
      setOutput(out.choices[0].message.content);
      return out;
    }
  });

  return <div className="grid box-border h-screen md:grid-cols-2">
    <Editor onChange={handleChange} className="p-4 bg-neutral-100 outline-none font-sans text-base leading-relaxed" autofocus />
    <div className="p-4 box-border overflow-y-auto">
      <Markdown>{output}</Markdown>
    </div>
  </div >;
}
