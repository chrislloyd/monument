"use client";

import Editor, { EditorChangeHandler } from "@/Editor";
import Markdown from "@/Markdown";
import { complete } from "@/openai";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@uidotdev/usehooks";
import { useCallback, useDeferredValue, useState } from "react";

export default function Page() {
  const [doc, setDocument] = useState<string>("");

  const handleChange = useCallback<EditorChangeHandler>((e) => {
    setDocument(e);
  }, [setDocument]);

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

  return <div className="grid box-border h-screen md:grid-cols-2">
    <Editor onChange={handleChange} className="p-4 bg-neutral-50 outline-none font-sans text-base leading-relaxed" autofocus />
    <div className="p-4 box-border overflow-y-auto">
      <Markdown>{output.data?.choices[0].message.content}</Markdown>
    </div>
  </div >;
}
