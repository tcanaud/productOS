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
import type { LiveReviewItem } from '@/lib/session/types';
import { ReviewTaskPanel } from './ReviewTaskPanel';
import { CheckpointTimeline } from './CheckpointTimeline';
import { useCheckpointTree } from '@/hooks/useCheckpointTree';
import type { StudioSessionState } from '@/lib/graphs/studio-session.types';

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
  // Live review items (persistent todo-list panel)
  const [liveReviewItems, setLiveReviewItems] = useState<LiveReviewItem[]>([]);
  const [isReviewRunning, setIsReviewRunning] = useState(false);

  // Checkpoint tree for undo/redo/branching
  const cpTree = useCheckpointTree();
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(false);

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

        // Load checkpoint tree (includes lazy migration on the server side)
        if (studioId) await cpTree.loadTree(workspaceId, studioId);
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

  // Prune review items whose nodeId no longer exists in the current graph
  const pruneStaleReviewItems = useCallback((graph: JsonGraph) => {
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    setLiveReviewItems((prev) => {
      const filtered = prev.filter((item) => nodeIds.has(item.nodeId));
      if (filtered.length < prev.length) {
        // Persist pruned list (best-effort)
        fetch('/api/ai/live-review', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            studioId: currentStudioIdRef.current,
            dismissIds: prev.filter((item) => !nodeIds.has(item.nodeId)).map((item) => item.id),
          }),
        }).catch(() => {});
      }
      return filtered;
    });
  }, [workspaceId]);

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
        pruneStaleReviewItems(payload.jsonGraph);
        setIsStreaming(true);
        setTimeout(() => {
          setDiagramContent(payload.mermaidSyntax);
          setIsStreaming(false);
        }, 600);
        // Inject summary as chat message
        if (payload.summary) {
          setMessages((prev) => [
            ...prev,
            {
              id: `${event.id}-summary`,
              role: 'assistant' as const,
              content: payload.summary!,
              timestamp: new Date(event.timestamp),
            },
          ]);
        }
        setIsLoading(false);
      } else if (event.type === 'diagram-update') {
        const payload = event.data as DiagramUpdatePayload;
        if (currentGraphRef.current) {
          currentGraphRef.current = applyPatch(currentGraphRef.current, payload.patch);
          pruneStaleReviewItems(currentGraphRef.current);
        }
        // Inject summary as chat message
        if (payload.summary) {
          setMessages((prev) => [
            ...prev,
            {
              id: `${event.id}-summary`,
              role: 'assistant' as const,
              content: payload.summary!,
              timestamp: new Date(event.timestamp),
            },
          ]);
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
  }, [events, pruneStaleReviewItems]);

  // Load persisted live review items on hydration (scoped to current studio)
  useEffect(() => {
    if (!workspaceId || !currentStudioId) return;
    const params = new URLSearchParams({ workspaceId, studioId: currentStudioId });
    fetch(`/api/ai/live-review?${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.liveReviewItems) setLiveReviewItems(data.liveReviewItems);
      })
      .catch(() => {});
  }, [workspaceId, currentStudioId]);

  // Manual live review trigger
  const handleReanalyze = useCallback(async () => {
    const graph = currentGraphRef.current;
    if (!graph) return;
    setIsReviewRunning(true);
    try {
      const res = await fetch('/api/ai/live-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, studioId: currentStudioId, graph }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { liveReviewItems: LiveReviewItem[] };
      setLiveReviewItems(data.liveReviewItems ?? []);
    } catch {
      // Best-effort
    } finally {
      setIsReviewRunning(false);
    }
  }, [workspaceId, currentStudioId]);

  // Dismiss a single review item
  const handleDismissReviewItem = useCallback(
    (id: string) => {
      setLiveReviewItems((prev) => prev.filter((item) => item.id !== id));
      // Persist dismissal (best-effort)
      fetch('/api/ai/live-review', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, studioId: currentStudioId, dismissIds: [id] }),
      }).catch(() => {});
    },
    [workspaceId, currentStudioId]
  );

  // Send a review item to chat for discussion
  const handleSendReviewToChat = useCallback(
    (item: LiveReviewItem) => {
      const chatMessage = `I'd like to discuss this review observation about node "${item.nodeId}":\n\n> ${item.message}${item.description ? `\n> ${item.description}` : ''}\n\n${item.suggestions?.length ? `Suggestions: \n- ${item.suggestions.join('\n- ')}` : ''}\n\nWhat do you suggest?`;
      setInputValue(chatMessage);
      inputRef.current?.focus();
    },
    []
  );

  // Story 7.4: handle graph update from AI node actions (expand / simplify)
  const handleGraphUpdate = useCallback((updatedGraph: JsonGraph) => {
    currentGraphRef.current = updatedGraph;
    pruneStaleReviewItems(updatedGraph);
    try {
      const mermaid = json2mermaid(updatedGraph);
      setDiagramContent(mermaid);
    } catch {
      // If conversion fails, keep the existing diagram content unchanged
    }
  }, [pruneStaleReviewItems]);

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

      const body: Record<string, unknown> = {
        userMessage: answer,
      };
      if (checkpointRef.current) body.checkpoint = checkpointRef.current;
      if (sessionId) body.sessionId = sessionId;
      if (currentStudioId) body.studioId = currentStudioId;
      // Checkpoint tree tracking
      if (cpTree.headId) body.headCheckpointId = cpTree.headId;
      body.activeBranchName = cpTree.activeBranch;
      body.turnNumber = cpTree.turnNumber;
      body.messageHistory = messagesRef.current;

      try {
        const res = await fetch(`/api/studio/${workspaceId}/interact`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);

        const data = (await res.json()) as Record<string, unknown>;

        // Track checkpoint tree position from response
        if (data.headCheckpointId) {
          cpTree.trackTurn(
            data.headCheckpointId as string,
            data.activeBranchName as string,
            data.turnNumber as number
          );
        }

        if (data.type === 'question') {
          checkpointRef.current = data.checkpoint;
          setIsLoading(false);
        } else if (data.type === 'diagram') {
          checkpointRef.current = data.checkpoint;
          if (data.summary) {
            setMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: 'assistant' as const,
                content: data.summary as string,
                timestamp: new Date(),
              },
            ]);
          }
          setIsLoading(false);
        } else if (data.type === 'complete') {
          checkpointRef.current = null;
          setSessionId(null);
          setIsLoading(false);
        } else if (data.type === 'error') {
          throw new Error(data.message as string);
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
    [workspaceId, sessionId, currentStudioId, cpTree]
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
      const body: Record<string, unknown> = {
        userMessage: text.trim(),
        sessionId: currentSessionId,
      };
      if (checkpointRef.current) {
        body.checkpoint = checkpointRef.current;
      }
      if (currentStudioId) {
        body.studioId = currentStudioId;
      }
      // Checkpoint tree tracking
      if (cpTree.headId) body.headCheckpointId = cpTree.headId;
      body.activeBranchName = cpTree.activeBranch;
      body.turnNumber = cpTree.turnNumber;
      body.messageHistory = messagesRef.current;

      const res = await fetch(`/api/studio/${workspaceId}/interact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Server error ${res.status}`);
      }

      const data = (await res.json()) as Record<string, unknown>;

      // Track checkpoint tree position from response
      if (data.headCheckpointId) {
        cpTree.trackTurn(
          data.headCheckpointId as string,
          data.activeBranchName as string,
          data.turnNumber as number
        );
      }

      // Capture studioId from server response (created on first message)
      // Use window.history.replaceState to update URL without triggering a Next.js navigation
      // (router.replace would remount the component and lose all in-memory state)
      if (data.studioId && !currentStudioId) {
        setCurrentStudioId(data.studioId as string);
        window.history.replaceState(null, '', `/workspaces/${workspaceId}/studio/${data.studioId}`);
      }

      if (data.type === 'question') {
        // Store checkpoint for next turn
        checkpointRef.current = data.checkpoint;

        // When SSE is active AND the response has personas, SSE events already
        // handle rendering persona bubbles + roundtable — skip to avoid duplicates.
        const personas = data.personas as PersonaBubble[] | undefined;
        const roundtable = data.roundtable as RoundtableData | undefined;
        const hasPersonas = personas && personas.length > 0;
        if (!(currentSessionId && hasPersonas)) {
          const aiMessage: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.content as string,
            timestamp: new Date(),
            personas,
            roundtable,
          };
          setMessages((prev) => [...prev, aiMessage]);
        }
        setIsLoading(false);
      } else if (data.type === 'diagram') {
        // Store checkpoint for potential refinement turns
        checkpointRef.current = data.checkpoint;

        // Inject summary as chat message (both SSE and non-SSE paths)
        if (data.summary && !currentSessionId) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant' as const,
              content: data.summary as string,
              timestamp: new Date(),
            },
          ]);
        }

        // When SSE is active, diagram-full / diagram-update events handle rendering.
        if (!currentSessionId) {
          setIsStreaming(true);
          setIsLoading(false);

          setTimeout(() => {
            setDiagramContent(data.mermaid as string);
            setIsStreaming(false);

            if (data.patchAnimation) {
              setPatchAnimation(data.patchAnimation as PatchAnimationEvent);

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
        throw new Error(data.message as string);
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

  // Derive annotations for diagram badge overlay from active live review items
  const annotations: Annotation[] = liveReviewItems.filter((item) => !item.dismissedAt);

  // Callback for DiagramPreviewPanel to inject summary messages (expand/simplify)
  const handleSummaryMessage = useCallback((summary: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: summary,
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Checkpoint restore handler — updates all studio state from a past checkpoint
  const handleCheckpointRestore = useCallback(
    async (checkpointId: string) => {
      const sid = currentStudioId;
      if (!sid) return;
      setIsLoading(true);
      const result = await cpTree.restore(workspaceId, sid, checkpointId);
      if (result) {
        // Restore checkpoint for graph resumption
        checkpointRef.current = result.checkpoint;
        // Restore messages (clear if none saved at this checkpoint)
        if (result.messageHistory && Array.isArray(result.messageHistory)) {
          const restored: Message[] = (result.messageHistory as Record<string, unknown>[]).map(
            (m) => ({
              ...m,
              timestamp: new Date(m.timestamp as string),
            })
          ) as Message[];
          setMessages(restored);
        } else {
          setMessages([]);
        }
        // Restore diagram from graphState (clear if no diagram at this checkpoint)
        const gs = result.graphState as StudioSessionState;
        if (gs?.currentDiagram) {
          currentGraphRef.current = gs.currentDiagram as JsonGraph;
          pruneStaleReviewItems(gs.currentDiagram as JsonGraph);
          try {
            const mermaid = json2mermaid(gs.currentDiagram as JsonGraph);
            setDiagramContent(mermaid);
          } catch {
            // Best-effort
          }
        } else {
          currentGraphRef.current = null;
          setDiagramContent(undefined);
          setLiveReviewItems([]);
        }
        // Clear interaction widget and animation state
        setInteractionPayload(undefined);
        setPatchAnimation(undefined);
        toast.success(`Restored to turn ${result.turnNumber}`);
      } else {
        toast.error('Failed to restore checkpoint');
      }
      setIsLoading(false);
    },
    [workspaceId, currentStudioId, cpTree, pruneStaleReviewItems]
  );

  // Checkpoint fork handler — creates a new studio from a past checkpoint
  const handleCheckpointFork = useCallback(
    async (checkpointId: string) => {
      const sid = currentStudioId;
      if (!sid) return;
      const result = await cpTree.fork(workspaceId, sid, checkpointId, 'Forked Studio');
      if (result) {
        // Navigate to the new studio
        window.location.href = `/workspaces/${workspaceId}/studio/${result.studioId}`;
      } else {
        toast.error('Failed to fork studio');
      }
    },
    [workspaceId, currentStudioId, cpTree]
  );

  // Keyboard shortcuts: Ctrl+Z → undo, Ctrl+Shift+Z → redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if chat input is focused
      if (
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLInputElement
      ) {
        return;
      }

      const isMeta = e.ctrlKey || e.metaKey;
      if (isMeta && e.key === 'z' && !e.shiftKey && cpTree.canUndo && cpTree.undoId) {
        e.preventDefault();
        void handleCheckpointRestore(cpTree.undoId);
      }
      if (isMeta && e.key === 'z' && e.shiftKey && cpTree.canRedo && cpTree.redoId) {
        e.preventDefault();
        void handleCheckpointRestore(cpTree.redoId);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [cpTree.canUndo, cpTree.canRedo, cpTree.undoId, cpTree.redoId, handleCheckpointRestore]);

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

        {/* Checkpoint timeline — collapsible section */}
        {cpTree.tree.length > 0 && (
          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => setIsTimelineExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
            >
              <span>Timeline ({cpTree.tree.length})</span>
              <span>{isTimelineExpanded ? '\u25B2' : '\u25BC'}</span>
            </button>
            {isTimelineExpanded && (
              <CheckpointTimeline
                tree={cpTree.tree}
                headId={cpTree.headId}
                activeBranch={cpTree.activeBranch}
                onRestore={handleCheckpointRestore}
                onFork={handleCheckpointFork}
              />
            )}
          </div>
        )}
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Diagram panel */}
        <div className="flex-1 overflow-hidden">
          <DiagramPreviewPanel
            diagramContent={diagramContent}
            isStreaming={isStreaming}
            patchAnimation={patchAnimation}
            graph={currentGraphRef.current ?? undefined}
            annotations={annotations}
            isReviewRunning={isReviewRunning}
            onGraphUpdate={handleGraphUpdate}
            onSummaryMessage={handleSummaryMessage}
            workspaceId={workspaceId}
          />
        </div>

        {/* Live Review Panel */}
        <div className="w-72 flex-shrink-0 border-l border-border overflow-hidden">
          <ReviewTaskPanel
            items={liveReviewItems}
            isAnalyzing={isReviewRunning}
            onReanalyze={handleReanalyze}
            onDismiss={handleDismissReviewItem}
            onSendToChat={handleSendReviewToChat}
          />
        </div>
      </div>
    </div>
  );
}
