"use client";

import { useCallback, useDeferredValue, useState, type ChangeEventHandler } from "react";
import { useQuery } from "@tanstack/react-query";
import { complete } from "@/openai";
import { useDebounce } from "@uidotdev/usehooks";
import Markdown from "@/Markdown";

export default function Page() {
  const [doc, setDocument] = useState<string>(``);
  const deferredDocument = useDeferredValue(doc);
  const debouncedDocument = useDebounce(deferredDocument.trim(), 500);
  const output = useQuery({
    // Using the whole document as the key might seem niaive, but the
    // alternative is that we hash the document, which `react-query` already
    // does that for us. We can use our own hash when it's needed elsewhere.
    queryKey: ['document', debouncedDocument],
    queryFn: async ({ signal }) => {
      return await complete([{ role: "user", content: debouncedDocument }], signal);
    }
  });

  const handleChange = useCallback<ChangeEventHandler<HTMLTextAreaElement>>((e) => {
    setDocument(e.target.value);
  }, [setDocument]);

  return <div className="grid box-border h-screen md:grid-cols-2">
    <textarea
      className="p-4 bg-neutral-50 border-none box-border font-sans text-base leading-relaxed resize-y md:resize-none outline-none"
      value={doc}
      onChange={handleChange}
      autoFocus
    />
    <div className="p-4 box-border overflow-y-auto">
      <Markdown>{output.data?.choices[0].message.content}</Markdown>
    </div>
  </div >;
}
