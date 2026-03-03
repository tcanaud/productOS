'use client';

import { RefObject } from 'react';
import { MessageList } from './MessageList';
import { ConversationInput } from './ConversationInput';
import { SuggestionChips } from './SuggestionChips';
import type { Message } from './StudioLayout';

type ConversationPanelProps = {
  messages: Message[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: (value: string) => void;
  onChipSelect: (chip: string) => void;
  isLoading: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
};

export function ConversationPanel({
  messages,
  inputValue,
  onInputChange,
  onSend,
  onChipSelect,
  isLoading,
  inputRef,
}: ConversationPanelProps) {
  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8 text-center">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Welcome to Studio</h2>
            <p className="text-sm text-muted-foreground">
              Describe your product idea or flow, and I&apos;ll help you design it.
            </p>
          </div>
          <SuggestionChips onSelect={onChipSelect} />
        </div>
      ) : (
        <MessageList messages={messages} isLoading={isLoading} onSuggestionClick={onChipSelect} />
      )}

      <div className="border-t border-border p-4">
        <ConversationInput
          value={inputValue}
          onChange={onInputChange}
          onSend={onSend}
          disabled={isLoading}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}
