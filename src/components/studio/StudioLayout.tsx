'use client';

import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { ConversationPanel } from './ConversationPanel';
import { DiagramPreviewPanel } from './DiagramPreviewPanel';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

interface StudioLayoutProps {
  workspaceId: string;
}

export function StudioLayout({ workspaceId }: StudioLayoutProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [diagramContent, setDiagramContent] = useState<string | undefined>(undefined);
  const [isStreaming, setIsStreaming] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Checkpoint from the graph runner — maintained across turns
  const checkpointRef = useRef<unknown>(null);

  async function handleSend(text: string) {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const body: { userMessage: string; checkpoint?: unknown } = {
        userMessage: text.trim(),
      };
      if (checkpointRef.current) {
        body.checkpoint = checkpointRef.current;
      }

      const res = await fetch(`/api/studio/${workspaceId}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const data = (await res.json()) as
        | { type: 'question'; content: string; checkpoint: unknown }
        | { type: 'diagram'; mermaid: string; checkpoint: unknown }
        | { type: 'complete'; diagramId: string }
        | { type: 'error'; message: string };

      if (data.type === 'question') {
        // Store checkpoint for next turn
        checkpointRef.current = data.checkpoint;

        const aiMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.content,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        setIsLoading(false);
      } else if (data.type === 'diagram') {
        // Store checkpoint for potential refinement turns
        checkpointRef.current = data.checkpoint;

        // Trigger progressive reveal: shimmer first, then diagram
        setIsStreaming(true);
        setIsLoading(false);

        setTimeout(() => {
          setDiagramContent(data.mermaid);
          setIsStreaming(false);
        }, 600);
      } else if (data.type === 'complete') {
        setIsLoading(false);
        toast.success('Diagram saved');
        checkpointRef.current = null;
      } else if (data.type === 'error') {
        throw new Error(data.message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, an error occurred: ${message}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsLoading(false);
    }
  }

  function handleChipSelect(chip: string) {
    setInputValue(chip);
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-full flex-col md:flex-row overflow-hidden">
      <div className="w-full md:w-2/5 flex-shrink-0 border-b border-border md:border-b-0 md:border-r md:border-border overflow-hidden">
        <ConversationPanel
          messages={messages}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSend={handleSend}
          onChipSelect={handleChipSelect}
          isLoading={isLoading}
          inputRef={inputRef}
        />
      </div>
      <div className="flex-1 overflow-hidden">
        <DiagramPreviewPanel diagramContent={diagramContent} isStreaming={isStreaming} />
      </div>
    </div>
  );
}
