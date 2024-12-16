"use client";

import Editor, { EditorChangeHandler } from "@/app/monument/Editor";
import { useCallback, useState } from "react";
import Assistant from "./Assistant";

export default function Page() {
  const [markdown, setMarkdown] = useState<string>("");

  const handleChange = useCallback<EditorChangeHandler>((e) => {
    setMarkdown(e);
  }, [setMarkdown]);

  return <div className="grid box-border h-screen md:grid-cols-2">
    <Editor onChange={handleChange} className="p-4 bg-neutral-100 outline-none font-sans text-base leading-relaxed" autofocus />
    <div className="p-4 box-border overflow-y-auto">
      <Assistant input={markdown} />
    </div>
  </div >;
}
