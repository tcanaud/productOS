'use client';

import { useState, useRef } from 'react';
import { ConversationPanel } from './ConversationPanel';
import { DiagramPreviewPanel } from './DiagramPreviewPanel';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

export function StudioLayout() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleSend(text: string) {
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

    setTimeout(() => {
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Got it! Generating your diagram...',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsLoading(false);
    }, 1000);
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
        <DiagramPreviewPanel />
      </div>
    </div>
  );
}
