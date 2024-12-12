import styles from '@/Editor.module.css';
import { $convertToMarkdownString, HEADING } from '@lexical/markdown';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { HeadingNode } from '@lexical/rich-text';
import { type EditorState } from 'lexical';
import { useCallback } from 'react';

export type EditorChangeHandler = (tokens: string) => void;
type Props = { autofocus?: boolean, onChange: EditorChangeHandler, className: string };

const TRANSFORMERS = [HEADING];

function onError(error: Error) {
  console.error(error);
}

export default function Editor({ autofocus = false, onChange, className }: Props) {
  const initialConfig = {
    namespace: 'editor',
    onError,
    theme: {
      paragraph: styles['paragraph'],
    },
    nodes: [
      HeadingNode,
    ]
  };

  const handleChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const markdown = $convertToMarkdownString(TRANSFORMERS);
      onChange(markdown);
    });
  }, [onChange]);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <RichTextPlugin
        contentEditable={<ContentEditable className={className} />}
        ErrorBoundary={LexicalErrorBoundary}
      />
      {autofocus && <AutoFocusPlugin />}
      <OnChangePlugin onChange={handleChange} />
    </LexicalComposer>
  );
}
