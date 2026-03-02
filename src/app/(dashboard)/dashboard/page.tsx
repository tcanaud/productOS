import { getCurrentUser } from '@/lib/auth-utils';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground">Welcome back, {user.name ?? user.email}!</p>
    </div>
  );
}
