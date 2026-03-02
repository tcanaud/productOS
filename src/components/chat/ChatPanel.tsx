'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { PersonaMessage } from './PersonaMessage';
import { ALL_PERSONA_IDS, PERSONAS } from '@/lib/ai/prompts/personas';
import type { PersonaResponse } from '@/lib/ai/schemas/chat-response';

type ConversationEntry =
  | { type: 'user'; content: string }
  | { type: 'responses'; responses: PersonaResponse[]; turn: number };

type HistoryMessage = { role: 'user' | 'assistant'; content: string; personaId?: string };

type Props = {
  workspaceId: string;
};

export function ChatPanel({ workspaceId }: Props) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleSend = async () => {
    const message = input.trim();
    if (!message || isLoading) return;

    setInput('');
    setConversation((prev) => [...prev, { type: 'user', content: message }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          message,
          history: history.map((h) => ({ role: h.role, content: h.content })),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Request failed (${res.status})`);
      }

      const data = (await res.json()) as {
        responses: PersonaResponse[];
        turn: number;
        latencyMs?: number;
      };

      setConversation((prev) => [
        ...prev,
        { type: 'responses', responses: data.responses, turn: data.turn },
      ]);

      // Update history for next turn
      setHistory((prev) => [
        ...prev,
        { role: 'user', content: message },
        ...data.responses.map((r) => ({
          role: 'assistant' as const,
          content: r.message,
          personaId: r.personaId,
        })),
      ]);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Chat failed. Please try again.';
      toast.error(errMsg);
      // Remove the user message on error
      setConversation((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Persona legend */}
      <div className="flex flex-wrap gap-2 border-b px-4 py-2">
        {ALL_PERSONA_IDS.map((id) => {
          const p = PERSONAS[id];
          return (
            <span
              key={id}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ backgroundColor: `${p.color}15`, color: p.color }}
            >
              {p.icon} {p.name}
            </span>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground self-center">
          Tip: use @Analyst, @Critic, etc. to address a specific persona
        </span>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto space-y-4 px-4 py-4">
        {conversation.length === 0 && (
          <p className="text-center text-sm text-muted-foreground mt-8">
            Start a conversation about your product design. The AI team will respond with distinct
            perspectives.
          </p>
        )}

        {conversation.map((entry, idx) => {
          if (entry.type === 'user') {
            return (
              <div key={idx} className="flex justify-end">
                <div className="max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
                  {entry.content}
                </div>
              </div>
            );
          }

          return (
            <div key={idx} className="space-y-4">
              {entry.responses.map((r) => (
                <PersonaMessage key={r.personaId} response={r} />
              ))}
            </div>
          );
        })}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="flex gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-full bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-24 rounded bg-muted" />
                  <div className="h-3 w-full rounded bg-muted" />
                  <div className="h-3 w-3/4 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t px-4 py-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your AI team... (Enter to send, Shift+Enter for new line)"
            rows={2}
            disabled={isLoading}
            className="flex-1 resize-none rounded border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            onClick={() => void handleSend()}
            disabled={isLoading || !input.trim()}
            className="flex items-center gap-1 rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? (
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
