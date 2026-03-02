'use client';

import dynamic from 'next/dynamic';
import { useCallback, useRef } from 'react';
import type * as MonacoType from 'monaco-editor';

// Monaco does not support SSR — must be dynamically imported with ssr: false
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((m) => m.Editor), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});

// Mermaid keywords for syntax highlighting
const MERMAID_KEYWORDS = [
  'graph',
  'flowchart',
  'sequenceDiagram',
  'stateDiagram',
  'stateDiagram-v2',
  'classDiagram',
  'erDiagram',
  'gantt',
  'pie',
  'gitGraph',
  'mindmap',
  'subgraph',
  'end',
  'participant',
  'actor',
  'Note',
  'note',
  'loop',
  'alt',
  'else',
  'opt',
  'par',
  'and',
  'critical',
  'break',
  'rect',
  'state',
  'direction',
  'TD',
  'TB',
  'BT',
  'LR',
  'RL',
];

function registerMermaidLanguage(monaco: typeof MonacoType) {
  if (monaco.languages.getLanguages().some((l) => l.id === 'mermaid')) return;

  monaco.languages.register({ id: 'mermaid' });

  monaco.languages.setMonarchTokensProvider('mermaid', {
    keywords: MERMAID_KEYWORDS,
    tokenizer: {
      root: [
        // Comments
        [/%%.*$/, 'comment'],
        // Keywords
        [
          /[a-zA-Z_$][\w$]*/,
          {
            cases: {
              '@keywords': 'keyword',
              '@default': 'identifier',
            },
          },
        ],
        // Strings
        [/"[^"]*"/, 'string'],
        [/'[^']*'/, 'string'],
        // Arrows
        [/-->|->|-->>|--x|--o|==>|===|~~~|\.\.\.>/, 'operator'],
        // Numbers
        [/\d+/, 'number'],
        // Brackets
        [/[{}()[\]]/, 'delimiter.bracket'],
        // Colon
        [/:/, 'delimiter'],
        // Pipes for labels
        [/\|[^|]*\|/, 'string'],
      ],
    },
  });
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

export function MonacoMermaidEditor({ value, onChange, readOnly = false }: Props) {
  const monacoRef = useRef<typeof MonacoType | null>(null);

  const handleEditorWillMount = useCallback((monaco: typeof MonacoType) => {
    registerMermaidLanguage(monaco);
    monacoRef.current = monaco;
  }, []);

  const handleChange = useCallback(
    (val: string | undefined) => {
      onChange(val ?? '');
    },
    [onChange]
  );

  return (
    <MonacoEditor
      height="100%"
      language="mermaid"
      value={value}
      onChange={handleChange}
      beforeMount={handleEditorWillMount}
      options={{
        fontSize: 14,
        minimap: { enabled: false },
        wordWrap: 'off',
        scrollBeyondLastLine: false,
        lineNumbers: 'on',
        readOnly,
        automaticLayout: true,
        tabSize: 2,
        renderWhitespace: 'none',
        theme: 'vs-dark',
      }}
    />
  );
}
