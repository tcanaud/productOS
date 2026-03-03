'use client';

/**
 * NodeChatModal — Story 7.4
 *
 * Opens when the user selects "Ask a question about this node" from the context menu.
 * Pre-fills a question about the selected node, sends it to /api/ai/chat, and
 * displays the reply in a simple single-turn conversation.
 */
import { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NodeChatModalProps {
  nodeId: string;
  nodeLabel: string;
  workspaceId: string;
  onClose: () => void;
}

interface ChatReply {
  role: 'user' | 'assistant';
  content: string;
}

export function NodeChatModal({ nodeId, nodeLabel, workspaceId, onClose }: NodeChatModalProps) {
  const defaultQuestion = `Tell me more about the step: «${nodeLabel}»`;
  const [input, setInput] = useState(defaultQuestion);
  const [messages, setMessages] = useState<ChatReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Auto-select the pre-filled question on first open
  useEffect(() => {
    textareaRef.current?.select();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          message: question,
          context: { nodeId, nodeLabel },
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Server error ${res.status}`);
      }

      const data = (await res.json()) as {
        responses?: Array<{ message: string }>;
        reply?: string;
      };

      // Support both the full chat route (responses[]) and the stub ({ reply })
      const reply = data.responses?.[0]?.message ?? data.reply ?? 'No response received.';

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" aria-hidden="true" onClick={onClose} />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ask about node: ${nodeLabel}`}
        className="fixed bottom-6 right-6 z-50 flex w-96 flex-col rounded-lg border border-border bg-background shadow-xl"
        style={{ maxHeight: '70vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Asking about</p>
            <p className="truncate text-sm font-semibold text-foreground">{nodeLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 px-4 py-3 text-sm">
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Ask a question about this node and the AI will answer.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 ${
                m.role === 'user'
                  ? 'ml-6 bg-primary text-primary-foreground'
                  : 'mr-6 bg-muted text-foreground'
              }`}
            >
              {m.content}
            </div>
          ))}
          {isLoading && (
            <div className="mr-6 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">Thinking…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Ask a question…"
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={isLoading}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  );
}
