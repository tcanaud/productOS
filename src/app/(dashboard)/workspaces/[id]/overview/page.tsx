import { getCurrentUser } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { GitBranch, FileText, MessageCircle, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type PageProps = { params: Promise<{ id: string }> };

const ARTIFACT_SECTIONS = [
  {
    key: 'diagrams',
    label: 'Diagrams',
    description: 'Flow diagrams and architecture charts',
    icon: GitBranch,
    color: 'text-blue-500',
  },
  {
    key: 'specs',
    label: 'Specs',
    description: 'Product requirements and specifications',
    icon: FileText,
    color: 'text-green-500',
  },
  {
    key: 'chat',
    label: 'Chat History',
    description: 'AI-assisted multi-persona conversations',
    icon: MessageCircle,
    color: 'text-purple-500',
  },
] as const;

export default async function WorkspaceOverviewPage({ params }: PageProps) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const workspace = await prisma.workspace.findFirst({
    where: { id, members: { some: { userId: user.id } } },
  });
  if (!workspace) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
        {workspace.description && (
          <p className="mt-1 text-sm text-muted-foreground">{workspace.description}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ARTIFACT_SECTIONS.map(({ key, label, description, icon: Icon, color }) => (
          <Card key={key} className="transition-shadow hover:shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${color}`} />
                <CardTitle className="text-base">{label}</CardTitle>
              </div>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={`/workspaces/${id}/${key}`}>
                  Open {label}
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
