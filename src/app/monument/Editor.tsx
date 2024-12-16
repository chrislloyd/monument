import styles from '@/app/monument/Editor.module.css';
import { $convertToMarkdownString } from '@lexical/markdown';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { type EditorState } from 'lexical';
import { useCallback } from 'react';
import { PortalNode } from './PortalNode';
import { PortalTransformer } from './PortalTransformer';

export type EditorChangeHandler = (tokens: string) => void;

type Props = { autofocus?: boolean, onChange: EditorChangeHandler, className: string };

export default function Editor({ autofocus = false, onChange, className }: Props) {
  const transformers = [PortalTransformer];
  const initialConfig = {
    namespace: 'editor',
    theme: {
      paragraph: styles['paragraph'],
    },
    nodes: [
      PortalNode,
    ],
    onError(error: any) {
      console.error(error);
    }
  };

  const handleChange = useCallback((editorState: EditorState) => {
    editorState.read(() => {
      const markdown = $convertToMarkdownString(transformers);
      onChange(markdown);
    });
  }, [onChange]);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <MarkdownShortcutPlugin transformers={transformers} />
      <RichTextPlugin
        contentEditable={<ContentEditable className={className} />}
        ErrorBoundary={LexicalErrorBoundary}
      />
      {autofocus && <AutoFocusPlugin />}
      <OnChangePlugin onChange={handleChange} />
    </LexicalComposer>
  );
}
