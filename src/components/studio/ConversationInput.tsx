import { RefObject, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type ConversationInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
  disabled?: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
};

export function ConversationInput({
  value,
  onChange,
  onSend,
  disabled = false,
  inputRef,
}: ConversationInputProps) {
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(value);
    }
  }

  return (
    <div className="flex items-end gap-2">
      <Textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe your product idea or flow..."
        disabled={disabled}
        rows={3}
        className="resize-none"
        aria-label="Conversation input"
      />
      <Button
        type="button"
        size="icon"
        onClick={() => onSend(value)}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
