import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect } from "react";

type Props = {
  alt: string,
  src: string,
  value: string | undefined,
  onChange: (value: string) => void
};


export default function Portal({ alt, src, value, onChange }: Props) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const interval = setInterval(() => {
      const value = new Date().toLocaleString();
      editor.update(() => {
        onChange(value);
      });
    }, 1000);
    return () => clearInterval(interval);
  });

  const classNames = new Set([
    "inline-block",
    "px-2",
    "rounded-full",
    "shadow",
    "transition-all",
    "duration-300",
    "ease-in-out",
    "w-fit"
  ]);
  if (!value) {
    classNames.add('bg-white');
    classNames.add('text-neutral-400');
  } else {
    classNames.add("bg-emerald-100");
    classNames.add("text-emerald-800");
  }
  const title = alt || src;
  return <div className={Array.from(classNames).join(' ')} title={title}>
    {value ? value : (
      <span className="opacity-40">{src}</span>
    )}
  </div>
}