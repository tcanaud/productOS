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
  RoundtablePayload,
  DiagramFullPayload,
  DiagramUpdatePayload,
  InteractionPayload,
} from '@/lib/sse/sse.types';
import { json2mermaid } from '@/lib/json2mermaid';
import type { JsonGraph } from '@/lib/json2mermaid/types';
import type { Annotation } from '@/lib/ai/graphs/live-review.graph';

export type PersonaBubble = {
  personaId: string;
  displayName: string;
  icon: string;
  color: string;
  content: string;
  emotion?: string;
  replyTo?: string;
};

export type RoundtableData = {
  questions: string[];
  suggestions: string[];
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  /** Party-mode: when present, render as staggered PersonaMessageBubble list instead of plain bubble. */
  personas?: PersonaBubble[];
  /** Roundtable block: synthesized questions + clickable suggestions shown after persona messages. */
  roundtable?: RoundtableData;
};

interface StudioLayoutProps {
  workspaceId: string;
  studioId?: string; // undefined = new studio
}

export function StudioLayout({ workspaceId, studioId }: StudioLayoutProps) {
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

  // Current studio ID — starts from prop, set on first message if new
  const [currentStudioId, setCurrentStudioId] = useState<string | null>(studioId ?? null);
  // Track whether initial load from DB is done
  const [isHydrated, setIsHydrated] = useState(!studioId);

  // Checkpoint from the graph runner — maintained across turns
  const checkpointRef = useRef<unknown>(null);
  // Timer ref for clearing patchAnimation after 800ms (covers add 600ms + remove 400ms)
  const patchAnimationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Story 7.3: live review annotations
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const liveReviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Story 6.6: logical session ID for SSE routing (generated when a new session starts)
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Store current JsonGraph for incremental patch application
  const currentGraphRef = useRef<JsonGraph | null>(null);
  // Track which SSE event IDs have already been processed
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  // Story 6.6: SSE stream hook — subscribes when sessionId is set
  const { events, connectionState, waitForOpen } = useStudioStream(sessionId);

  // Hydrate from DB when opening an existing studio
  useEffect(() => {
    if (!studioId) return;

    let cancelled = false;
    async function hydrate() {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/studios/${studioId}`);
        if (!res.ok) {
          toast.error('Failed to load studio');
          return;
        }
        const data = await res.json();

        if (cancelled) return;

        // Restore messages
        if (data.messageHistory && Array.isArray(data.messageHistory)) {
          const restored: Message[] = data.messageHistory.map((m: Record<string, unknown>) => ({
            ...m,
            timestamp: new Date(m.timestamp as string),
          }));
          setMessages(restored);
        }

        // Restore checkpoint
        if (data.checkpoint) {
          checkpointRef.current = data.checkpoint;
        }

        // Restore diagram from graphState
        if (data.graphState?.currentDiagram) {
          currentGraphRef.current = data.graphState.currentDiagram as JsonGraph;
          try {
            const mermaid = json2mermaid(data.graphState.currentDiagram as JsonGraph);
            setDiagramContent(mermaid);
          } catch {
            // Conversion failed, skip
          }
        }

        // Restore SSE session ID (or generate new)
        if (data.sseSessionId) {
          setSessionId(data.sseSessionId);
        }
      } catch {
        toast.error('Failed to load studio');
      } finally {
        if (!cancelled) setIsHydrated(true);
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [studioId, workspaceId]);

  // Process incoming SSE events in arrival order
  useEffect(() => {
    for (const event of events) {
      if (processedEventIdsRef.current.has(event.id)) continue;
      processedEventIdsRef.current.add(event.id);

      if (event.type === 'persona-message') {
        const payload = event.data as PersonaMessagePayload;
        const bubble: PersonaBubble = {
          personaId: payload.persona,
          displayName: payload.displayName,
          icon: payload.icon,
          color: '#6B7280',
          content: payload.message,
          ...(payload.emotion ? { emotion: payload.emotion } : {}),
          ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
        };
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          // Append to an existing persona-group assistant message if it's the last one
          if (lastMsg?.role === 'assistant' && lastMsg.personas) {
            return prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, personas: [...(m.personas ?? []), bubble] }
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
              personas: [bubble],
            },
          ];
        });
        setIsLoading(false);
      } else if (event.type === 'roundtable') {
        const payload = event.data as RoundtablePayload;
        // Attach roundtable to the last assistant message (which has personas)
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg?.role === 'assistant') {
            return prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, roundtable: { questions: payload.questions, suggestions: payload.suggestions } }
                : m
            );
          }
          return prev;
        });
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

  // Story 7.3: trigger live review 2s after diagram content changes
  useEffect(() => {
    if (!diagramContent || !currentGraphRef.current) return;

    if (liveReviewTimerRef.current) clearTimeout(liveReviewTimerRef.current);

    liveReviewTimerRef.current = setTimeout(async () => {
      const graph = currentGraphRef.current;
      if (!graph) return;
      try {
        const res = await fetch(`/api/ai/live-review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId, graph }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { annotations: Annotation[] };
        setAnnotations(data.annotations ?? []);
      } catch {
        // Live review is best-effort; silently ignore errors
      }
    }, 2000);

    return () => {
      if (liveReviewTimerRef.current) clearTimeout(liveReviewTimerRef.current);
    };
  }, [diagramContent, workspaceId]);

  // Story 7.4: handle graph update from AI node actions (expand / simplify)
  const handleGraphUpdate = useCallback((updatedGraph: JsonGraph) => {
    currentGraphRef.current = updatedGraph;
    try {
      const mermaid = json2mermaid(updatedGraph);
      setDiagramContent(mermaid);
      // Clear stale annotations since the graph structure changed
      setAnnotations([]);
    } catch {
      // If conversion fails, keep the existing diagram content unchanged
    }
  }, []);

  // Helper to get current messages for persistence (uses a ref to avoid stale closures)
  const messagesRef = useRef<Message[]>(messages);
  messagesRef.current = messages;
  const currentStudioIdRef = useRef<string | null>(currentStudioId);
  currentStudioIdRef.current = currentStudioId;

  // Debounced background save of messageHistory whenever messages change
  const messageSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const sid = currentStudioIdRef.current;
    if (!sid || messages.length === 0) return;

    if (messageSaveTimerRef.current) clearTimeout(messageSaveTimerRef.current);
    messageSaveTimerRef.current = setTimeout(() => {
      fetch(`/api/workspaces/${workspaceId}/studios/${sid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageHistory: messages }),
      }).catch(() => {
        // Best-effort save, don't block the UI
      });
    }, 1500);

    return () => {
      if (messageSaveTimerRef.current) clearTimeout(messageSaveTimerRef.current);
    };
  }, [messages, workspaceId]);

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

      const body: {
        userMessage: string;
        checkpoint?: unknown;
        sessionId?: string;
        studioId?: string;
      } = {
        userMessage: answer,
      };
      if (checkpointRef.current) body.checkpoint = checkpointRef.current;
      if (sessionId) body.sessionId = sessionId;
      if (currentStudioId) body.studioId = currentStudioId;

      try {
        const res = await fetch(`/api/studio/${workspaceId}/interact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);

        const data = (await res.json()) as
          | { type: 'question'; content: string; checkpoint: unknown; studioId?: string; personas?: PersonaBubble[]; roundtable?: RoundtableData }
          | {
              type: 'diagram';
              mermaid: string;
              checkpoint: unknown;
              patchAnimation?: PatchAnimationEvent;
              studioId?: string;
            }
          | { type: 'complete'; diagramId: string; studioId?: string }
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
    [workspaceId, sessionId, currentStudioId]
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
    const isFirstMessage = !sessionId;
    const currentSessionId = sessionId ?? crypto.randomUUID();
    if (isFirstMessage) {
      setSessionId(currentSessionId);
      // Wait for the SSE EventSource to connect before sending the POST,
      // otherwise server-emitted events would be lost (race condition).
      await waitForOpen();
    }

    try {
      const body: {
        userMessage: string;
        checkpoint?: unknown;
        sessionId?: string;
        studioId?: string;
      } = {
        userMessage: text.trim(),
        sessionId: currentSessionId,
      };
      if (checkpointRef.current) {
        body.checkpoint = checkpointRef.current;
      }
      if (currentStudioId) {
        body.studioId = currentStudioId;
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
            roundtable?: RoundtableData;
            studioId?: string;
          }
        | {
            type: 'diagram';
            mermaid: string;
            checkpoint: unknown;
            patchAnimation?: PatchAnimationEvent;
            studioId?: string;
          }
        | { type: 'complete'; diagramId: string; studioId?: string }
        | { type: 'error'; message: string };

      // Capture studioId from server response (created on first message)
      // Use window.history.replaceState to update URL without triggering a Next.js navigation
      // (router.replace would remount the component and lose all in-memory state)
      if ('studioId' in data && data.studioId && !currentStudioId) {
        setCurrentStudioId(data.studioId);
        window.history.replaceState(null, '', `/workspaces/${workspaceId}/studio/${data.studioId}`);
      }

      if (data.type === 'question') {
        // Store checkpoint for next turn
        checkpointRef.current = data.checkpoint;

        // When SSE is active AND the response has personas, SSE events already
        // handle rendering persona bubbles + roundtable — skip to avoid duplicates.
        // Non-persona question responses (plain text) still need to be added here
        // because the SSE 'interaction' event only sets interactionPayload, not a message.
        const hasPersonas = data.personas && data.personas.length > 0;
        if (!(currentSessionId && hasPersonas)) {
          const aiMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.content,
            timestamp: new Date(),
            personas: data.personas,
            roundtable: data.roundtable,
          };
          setMessages((prev) => [...prev, aiMessage]);
        }
        setIsLoading(false);
      } else if (data.type === 'diagram') {
        // Store checkpoint for potential refinement turns
        checkpointRef.current = data.checkpoint;

        // When SSE is active, diagram-full / diagram-update events handle rendering.
        if (!currentSessionId) {
          setIsStreaming(true);
          setIsLoading(false);

          setTimeout(() => {
            setDiagramContent(data.mermaid);
            setIsStreaming(false);

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
        } else {
          setIsLoading(false);
        }
      } else if (data.type === 'complete') {
        setIsLoading(false);
        if (!currentSessionId) {
          toast.success('Diagram saved');
        }
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

  // Show loading spinner while hydrating from DB
  if (!isHydrated) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
      </div>
    );
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
          annotations={annotations}
          onGraphUpdate={handleGraphUpdate}
          workspaceId={workspaceId}
        />
      </div>
    </div>
  );
}
