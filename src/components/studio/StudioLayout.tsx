'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ConversationPanel } from './ConversationPanel';
import { DiagramPreviewPanel } from './DiagramPreviewPanel';
import { InteractionWidget } from './InteractionWidget';
import { SSEConnectionBadge } from './SSEConnectionBadge';
import { useStudioStream } from '@/hooks/useStudioStream';
import { applyPatch } from '@/lib/graphs/patch-applier';
import type { PatchAnimationEvent } from '@/lib/graphs/studio-session.types';
import type {
  PersonaMessagePayload,
  DiagramFullPayload,
  DiagramUpdatePayload,
  InteractionPayload,
} from '@/lib/sse/sse.types';
import type { JsonGraph } from '@/lib/json2mermaid/types';

export type PersonaBubble = {
  personaId: string;
  displayName: string;
  icon: string;
  color: string;
  content: string;
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Party-mode: when present, render as staggered PersonaMessageBubble list instead of plain bubble. */
  personas?: PersonaBubble[];
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
  const [patchAnimation, setPatchAnimation] = useState<PatchAnimationEvent | undefined>(undefined);
  const [interactionPayload, setInteractionPayload] = useState<InteractionPayload | undefined>(
    undefined
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Checkpoint from the graph runner — maintained across turns
  const checkpointRef = useRef<unknown>(null);
  // Timer ref for clearing patchAnimation after 800ms (covers add 600ms + remove 400ms)
  const patchAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Story 6.6: logical session ID for SSE routing (generated when a new session starts)
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Store current JsonGraph for incremental patch application
  const currentGraphRef = useRef<JsonGraph | null>(null);
  // Track which SSE event IDs have already been processed
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  // Story 6.6: SSE stream hook — subscribes when sessionId is set
  const { events, connectionState } = useStudioStream(sessionId);

  // Process incoming SSE events in arrival order
  useEffect(() => {
    for (const event of events) {
      if (processedEventIdsRef.current.has(event.id)) continue;
      processedEventIdsRef.current.add(event.id);

      if (event.type === 'persona-message') {
        const payload = event.data as PersonaMessagePayload;
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          // Append to an existing persona-group assistant message if it's the last one
          if (lastMsg?.role === 'assistant' && lastMsg.personas) {
            return prev.map((m, i) =>
              i === prev.length - 1
                ? {
                    ...m,
                    personas: [
                      ...(m.personas ?? []),
                      {
                        personaId: payload.persona,
                        displayName: payload.displayName,
                        icon: payload.icon,
                        color: '#6B7280',
                        content: payload.message,
                      },
                    ],
                  }
                : m
            );
          }
          return [
            ...prev,
            {
              id: event.id,
              role: 'assistant' as const,
              content: '',
              timestamp: new Date(event.timestamp),
              personas: [
                {
                  personaId: payload.persona,
                  displayName: payload.displayName,
                  icon: payload.icon,
                  color: '#6B7280',
                  content: payload.message,
                },
              ],
            },
          ];
        });
        setIsLoading(false);
      } else if (event.type === 'interaction') {
        setInteractionPayload(event.data as InteractionPayload);
        setIsLoading(false);
      } else if (event.type === 'diagram-full') {
        const payload = event.data as DiagramFullPayload;
        currentGraphRef.current = payload.jsonGraph;
        setIsStreaming(true);
        setTimeout(() => {
          setDiagramContent(payload.mermaidSyntax);
          setIsStreaming(false);
        }, 600);
        setIsLoading(false);
      } else if (event.type === 'diagram-update') {
        const payload = event.data as DiagramUpdatePayload;
        if (currentGraphRef.current) {
          currentGraphRef.current = applyPatch(currentGraphRef.current, payload.patch);
        }
        const patch = payload.patch;
        const addNodeIds = patch.addNodes?.map((n) => n.id) ?? [];
        const removeNodeIds = patch.removeNodes ?? [];
        const modifyNodeIds = patch.modifyNodes?.map((n) => n.id) ?? [];
        const addEdgeIds = (patch.addEdges?.map((e) => e.id).filter(Boolean) as string[]) ?? [];
        const removeEdgeIds = patch.removeEdges ?? [];

        let animEvent: PatchAnimationEvent | undefined;
        if (addNodeIds.length > 0 || addEdgeIds.length > 0) {
          animEvent = { type: 'add', nodeIds: addNodeIds, edgeIds: addEdgeIds };
        } else if (removeNodeIds.length > 0 || removeEdgeIds.length > 0) {
          animEvent = { type: 'remove', nodeIds: removeNodeIds, edgeIds: removeEdgeIds };
        } else if (modifyNodeIds.length > 0) {
          animEvent = { type: 'modify', nodeIds: modifyNodeIds, edgeIds: [] };
        }

        if (animEvent) {
          setPatchAnimation(animEvent);
          if (patchAnimationTimerRef.current) clearTimeout(patchAnimationTimerRef.current);
          patchAnimationTimerRef.current = setTimeout(() => setPatchAnimation(undefined), 800);
        }
        setIsLoading(false);
      } else if (event.type === 'session-end') {
        toast.success('Diagram saved');
        setIsLoading(false);
        checkpointRef.current = null;
        setSessionId(null);
      }
    }
  }, [events]);

  // Handle InteractionWidget response — resume graph with user's answer
  const handleRespond = useCallback(
    async (answer: string) => {
      setInteractionPayload(undefined);
      setIsLoading(true);

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: answer,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      const body: { userMessage: string; checkpoint?: unknown; sessionId?: string } = {
        userMessage: answer,
      };
      if (checkpointRef.current) body.checkpoint = checkpointRef.current;
      if (sessionId) body.sessionId = sessionId;

      try {
        const res = await fetch(`/api/studio/${workspaceId}/interact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);

        const data = (await res.json()) as
          | { type: 'question'; content: string; checkpoint: unknown; personas?: PersonaBubble[] }
          | {
              type: 'diagram';
              mermaid: string;
              checkpoint: unknown;
              patchAnimation?: PatchAnimationEvent;
            }
          | { type: 'complete'; diagramId: string }
          | { type: 'error'; message: string };

        if (data.type === 'question') {
          checkpointRef.current = data.checkpoint;
          setIsLoading(false);
        } else if (data.type === 'diagram') {
          checkpointRef.current = data.checkpoint;
          setIsLoading(false);
        } else if (data.type === 'complete') {
          checkpointRef.current = null;
          setSessionId(null);
          setIsLoading(false);
        } else if (data.type === 'error') {
          throw new Error(data.message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Something went wrong';
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant' as const,
            content: `Error: ${message}`,
            timestamp: new Date(),
          },
        ]);
        setIsLoading(false);
      }
    },
    [workspaceId, sessionId]
  );

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

    // Assign a session ID for SSE routing (persists across turns)
    const currentSessionId = sessionId ?? crypto.randomUUID();
    if (!sessionId) setSessionId(currentSessionId);

    try {
      const body: { userMessage: string; checkpoint?: unknown; sessionId?: string } = {
        userMessage: text.trim(),
        sessionId: currentSessionId,
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
        | {
            type: 'question';
            content: string;
            checkpoint: unknown;
            personas?: PersonaBubble[];
          }
        | {
            type: 'diagram';
            mermaid: string;
            checkpoint: unknown;
            patchAnimation?: PatchAnimationEvent;
          }
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
          // Party-mode: include parsed persona bubbles if present
          personas: data.personas,
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

          // Story 6.5: apply patch animation if present, clear after 800ms
          if (data.patchAnimation) {
            setPatchAnimation(data.patchAnimation);

            if (patchAnimationTimerRef.current) {
              clearTimeout(patchAnimationTimerRef.current);
            }
            patchAnimationTimerRef.current = setTimeout(() => {
              setPatchAnimation(undefined);
            }, 800);
          }
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
      <div className="w-full md:w-2/5 flex-shrink-0 border-b border-border md:border-b-0 md:border-r md:border-border overflow-hidden flex flex-col">
        {/* Story 6.6: Connection status badge — only shown when session is active and not 'open' */}
        {sessionId && (
          <div className="flex justify-end px-4 pt-2">
            <SSEConnectionBadge state={connectionState} />
          </div>
        )}

        <ConversationPanel
          messages={messages}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSend={handleSend}
          onChipSelect={handleChipSelect}
          isLoading={isLoading}
          inputRef={inputRef}
        />

        {/* Story 6.6: InteractionWidget blocks conversation input until user responds */}
        {interactionPayload && (
          <div className="border-t border-border p-4">
            <InteractionWidget
              payload={interactionPayload}
              onRespond={handleRespond}
              disabled={isLoading}
            />
          </div>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <DiagramPreviewPanel
          diagramContent={diagramContent}
          isStreaming={isStreaming}
          patchAnimation={patchAnimation}
          graph={currentGraphRef.current ?? undefined}
        />
      </div>
    </div>
  );
}
