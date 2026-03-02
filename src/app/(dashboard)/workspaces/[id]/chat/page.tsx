import { ChatPanel } from '@/components/chat/ChatPanel';

type PageProps = { params: Promise<{ id: string }> };

export default async function ChatPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-lg border">
      <ChatPanel workspaceId={id} />
    </div>
  );
}
