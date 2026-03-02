'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

type Props = {
  content: string;
};

let mermaidInitialized = false;

export function MermaidPreview({ content }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const renderMermaid = async () => {
      try {
        const mermaid = (await import('mermaid')).default;

        if (!mermaidInitialized) {
          mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
          mermaidInitialized = true;
        }

        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, content.trim() || 'flowchart TD\n  A[Start]');
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid Mermaid syntax');
      }
    };

    void renderMermaid();
  }, [content]);

  return (
    <div className="relative h-full w-full overflow-auto bg-white p-4">
      {error && (
        <div className="mb-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="font-mono">{error}</span>
        </div>
      )}
      <div ref={containerRef} className="flex min-h-[200px] items-center justify-center" />
    </div>
  );
}
