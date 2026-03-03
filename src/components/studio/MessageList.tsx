'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { Message } from './StudioLayout';
import { PersonaMessageBubble } from './PersonaMessageBubble';

type MessageListProps = {
  messages: Message[];
  isLoading: boolean;
};

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto space-y-3 px-4 py-3">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
        >
          {/* Party-mode: staggered persona bubbles */}
          {message.personas && message.personas.length > 0 ? (
            <div className="flex max-w-[90%] flex-col gap-2">
              {message.personas.map((pm, idx) => (
                <PersonaMessageBubble
                  key={pm.personaId}
                  displayName={pm.displayName}
                  icon={pm.icon}
                  color={pm.color}
                  content={pm.content}
                  animationDelay={idx * 150}
                />
              ))}
            </div>
          ) : (
            <div
              className={cn(
                'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {message.content}
            </div>
          )}
        </div>
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="flex items-center gap-1 rounded-lg bg-muted px-3 py-2">
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
