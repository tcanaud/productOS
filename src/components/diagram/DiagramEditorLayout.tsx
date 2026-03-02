'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { useAutosave } from '@/hooks/useAutosave';
import { VersionHistory, type DiagramVersion } from './VersionHistory';
import { MermaidPreview } from './MermaidPreview';
import { AIGeneratePanel } from './AIGeneratePanel';
import { ReviewPanel } from './ReviewPanel';
import { SpecPanel } from '@/components/specs/SpecPanel';

// Monaco is SSR-incompatible — load dynamically
const MonacoMermaidEditor = dynamic(
  () => import('./MonacoMermaidEditor').then((m) => m.MonacoMermaidEditor),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted/30" /> }
);

type Props = {
  diagramId: string;
  initialContent: string;
  initialTitle: string;
};

const DEBOUNCE_MS = 500;

type SidePanel = 'generate' | 'review' | 'specs' | null;

export function DiagramEditorLayout({ diagramId, initialContent, initialTitle }: Props) {
  const [content, setContent] = useState(initialContent);
  const [debouncedContent, setDebouncedContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [versions, setVersions] = useState<DiagramVersion[]>([]);
  const [sidePanel, setSidePanel] = useState<SidePanel>(null);

  // Debounce preview rendering (< 500ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedContent(content), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [content]);

  // Autosave every 5s
  const saveDiagram = useCallback(
    async (latestContent: string) => {
      await fetch(`/api/diagrams/${diagramId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: latestContent }),
      });
      // Refresh version list after save
      const res = await fetch(`/api/diagrams/${diagramId}/versions`);
      if (res.ok) {
        const data = (await res.json()) as DiagramVersion[];
        setVersions(data);
      }
    },
    [diagramId]
  );

  const { status } = useAutosave(content, { onSave: saveDiagram });

  // Load versions on mount
  useEffect(() => {
    const loadVersions = async () => {
      const res = await fetch(`/api/diagrams/${diagramId}/versions`);
      if (res.ok) {
        const data = (await res.json()) as DiagramVersion[];
        setVersions(data);
      }
    };
    void loadVersions();
  }, [diagramId]);

  // Save title (debounced inline)
  const saveTitle = useCallback(
    async (newTitle: string) => {
      await fetch(`/api/diagrams/${diagramId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
    },
    [diagramId]
  );

  useEffect(() => {
    const t = setTimeout(() => void saveTitle(title), 800);
    return () => clearTimeout(t);
  }, [title, saveTitle]);

  const handleRestore = async (version: DiagramVersion) => {
    const res = await fetch(`/api/diagrams/${diagramId}/versions/${version.id}/restore`, {
      method: 'POST',
    });
    if (res.ok) {
      setContent(version.content);
      // Refresh versions
      const vRes = await fetch(`/api/diagrams/${diagramId}/versions`);
      if (vRes.ok) setVersions((await vRes.json()) as DiagramVersion[]);
    }
  };

  const handleAIGenerated = (mermaidSyntax: string) => {
    setContent(mermaidSyntax);
    setSidePanel(null);
  };

  const togglePanel = (panel: SidePanel) => {
    setSidePanel((prev) => (prev === panel ? null : panel));
  };

  const saveIndicator: Record<typeof status, string> = {
    saved: 'Saved ✓',
    saving: 'Saving…',
    unsaved: 'Unsaved changes',
    error: 'Save failed',
  };

  const hasSidePanel = sidePanel !== null;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b bg-background px-4 py-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground"
          placeholder="Diagram title"
          aria-label="Diagram title"
        />
        <button
          onClick={() => togglePanel('generate')}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            sidePanel === 'generate'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          aria-pressed={sidePanel === 'generate'}
        >
          Generate with AI
        </button>
        <button
          onClick={() => togglePanel('review')}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            sidePanel === 'review'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          aria-pressed={sidePanel === 'review'}
        >
          Review with AI
        </button>
        <button
          onClick={() => togglePanel('specs')}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            sidePanel === 'specs'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
          aria-pressed={sidePanel === 'specs'}
        >
          Generate Specs
        </button>
        <span
          className={`text-xs ${
            status === 'saved'
              ? 'text-green-600'
              : status === 'error'
                ? 'text-red-500'
                : 'text-muted-foreground'
          }`}
        >
          {saveIndicator[status]}
        </span>
      </div>

      {/* Main editor area */}
      <div className="flex min-h-0 flex-1">
        <PanelGroup direction="horizontal" autoSaveId={`diagram-${diagramId}`}>
          <Panel defaultSize={hasSidePanel ? 40 : 50} minSize={20}>
            <div className="h-full">
              <MonacoMermaidEditor value={content} onChange={setContent} />
            </div>
          </Panel>
          <PanelResizeHandle className="w-1.5 cursor-col-resize bg-border hover:bg-primary/30 transition-colors" />
          <Panel defaultSize={hasSidePanel ? 30 : 40} minSize={20}>
            <MermaidPreview content={debouncedContent} />
          </Panel>
          <PanelResizeHandle className="w-1.5 cursor-col-resize bg-border hover:bg-primary/30 transition-colors" />
          {hasSidePanel ? (
            <>
              <Panel defaultSize={20} minSize={15} maxSize={40}>
                {sidePanel === 'generate' && (
                  <AIGeneratePanel
                    onGenerated={handleAIGenerated}
                    hasExistingContent={content.trim().length > 0}
                  />
                )}
                {sidePanel === 'review' && (
                  <ReviewPanel diagramId={diagramId} diagramContent={debouncedContent} />
                )}
                {sidePanel === 'specs' && (
                  <SpecPanel diagramId={diagramId} diagramContent={debouncedContent} />
                )}
              </Panel>
              <PanelResizeHandle className="w-1.5 cursor-col-resize bg-border hover:bg-primary/30 transition-colors" />
            </>
          ) : null}
          <Panel defaultSize={10} minSize={8} maxSize={30}>
            <VersionHistory versions={versions} onRestore={handleRestore} />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}
