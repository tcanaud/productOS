import { MessageCircle } from 'lucide-react';

type PageProps = { params: Promise<{ id: string }> };

export default async function ChatPage({ params }: PageProps) {
  const { id } = await params;
  void id;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <MessageCircle className="mb-4 h-10 w-10 text-muted-foreground/50" />
      <h2 className="text-base font-medium">Chat History</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        AI-assisted multi-persona conversations will appear here.
      </p>
      <p className="mt-1 text-xs text-muted-foreground">Coming in Epic 5.</p>
    </div>
  );
}
