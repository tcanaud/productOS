'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = { workspaceId: string };

const DEFAULT_CONTENT = `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
`;

export function NewDiagramButton({ workspaceId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/diagrams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Diagram', content: DEFAULT_CONTENT }),
      });
      if (res.ok) {
        const diagram = (await res.json()) as { id: string };
        router.push(`/workspaces/${workspaceId}/diagrams/${diagram.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" onClick={() => void handleCreate()} disabled={loading}>
      <Plus className="mr-1.5 h-4 w-4" />
      {loading ? 'Creating…' : 'New Diagram'}
    </Button>
  );
}
